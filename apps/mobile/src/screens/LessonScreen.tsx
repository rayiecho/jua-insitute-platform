import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { apiFetch } from '../lib/api';
import type { Learner } from '../lib/learner';

const DEBOUNCE_MS = 1750; // matches the agent's shared-focus debounce (Section 4.1, Section 7)

interface LessonData {
  node: { id: string; title: string; markdown_content: string };
  assignment: { id: string; title: string; instructions_markdown: string; starter_code: string } | null;
}

interface GradeResult {
  gradingStatus: 'needs_revision' | 'graded';
  score: number;
  rawError: string | null;
  feedback: string | null;
}

export function LessonScreen({ learner, slug }: { learner: Learner; slug: string }) {
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [code, setCode] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [grading, setGrading] = useState(false);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    apiFetch(`/api/lessons/${slug}`)
      .then((res) => res.json())
      .then(async (data: LessonData) => {
        setLesson(data);
        if (!data.assignment) return;
        const progressRes = await apiFetch(
          `/api/progress?learnerId=${encodeURIComponent(learner.id)}&assignmentId=${encodeURIComponent(data.assignment.id)}`,
        );
        const progress = await progressRes.json();
        setCode(progress.currentCodeState ?? data.assignment.starter_code ?? '');
      });
  }, [slug, learner.id]);

  function handleCodeChange(next: string) {
    setCode(next);
    setSaveStatus('idle');
    setGrade(null);
    if (!lesson?.assignment) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const res = await apiFetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ learnerId: learner.id, assignmentId: lesson.assignment!.id, code: next }),
        });
        setSaveStatus(res.ok ? 'saved' : 'error');
      } catch {
        setSaveStatus('error');
      }
    }, DEBOUNCE_MS);
  }

  async function handleSubmitForGrading() {
    if (!lesson?.assignment) return;
    setGrading(true);
    setGrade(null);
    try {
      const res = await apiFetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId: learner.id, assignmentId: lesson.assignment.id, code }),
      });
      const data = await res.json();
      if (res.ok) setGrade(data);
    } finally {
      setGrading(false);
    }
  }

  if (!lesson) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Markdown>{lesson.node.markdown_content}</Markdown>

        {lesson.assignment && (
          <>
            <View style={styles.divider} />
            <Text style={styles.assignmentTitle}>{lesson.assignment.title}</Text>
            <Markdown>{lesson.assignment.instructions_markdown}</Markdown>

            <View style={styles.editorHeader}>
              <Text style={styles.editorLabel}>assignment.py</Text>
              <Text style={styles.saveLabel}>
                {{ idle: '', saving: 'Saving…', saved: 'Saved', error: 'Failed to save' }[saveStatus]}
              </Text>
            </View>
            <TextInput
              style={styles.codeInput}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              value={code}
              onChangeText={handleCodeChange}
            />

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmitForGrading} disabled={grading}>
              {grading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Submit for grading</Text>}
            </TouchableOpacity>

            {grade && (
              <View style={[styles.gradeBox, grade.gradingStatus === 'needs_revision' && styles.gradeBoxError]}>
                <Text style={styles.gradeTitle}>
                  {grade.gradingStatus === 'needs_revision' ? "Doesn't run yet" : `Score: ${grade.score}`}
                </Text>
                {grade.feedback && <Text style={styles.gradeText}>{grade.feedback}</Text>}
                {grade.rawError && <Text style={styles.gradeError}>{grade.rawError}</Text>}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 48 },
  divider: { height: 1, backgroundColor: '#ddd', marginVertical: 16 },
  assignmentTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  editorHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, marginBottom: 4 },
  editorLabel: { fontSize: 12, color: '#666' },
  saveLabel: { fontSize: 12, color: '#666' },
  codeInput: {
    minHeight: 180,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    textAlignVertical: 'top',
  },
  submitButton: { backgroundColor: '#15803d', borderRadius: 6, padding: 12, alignItems: 'center', marginTop: 12 },
  buttonText: { color: '#fff', fontWeight: '600' },
  gradeBox: { marginTop: 12, padding: 12, borderRadius: 6, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' },
  gradeBoxError: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  gradeTitle: { fontWeight: '600', marginBottom: 4 },
  gradeText: { fontSize: 13 },
  gradeError: {
    marginTop: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    backgroundColor: '#111',
    color: '#eee',
    padding: 8,
    borderRadius: 4,
  },
});
