import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { type Learner, registerLearner } from '../lib/learner';

// No real auth yet (MVP scope, Section 1) — mirrors the web app's LearnerGate:
// gets-or-creates a platform_users row so the rest of the app has a stable
// UUID to key continuity/state-injection data on.
export function LoginScreen({ onLoggedIn }: { onLoggedIn: (learner: Learner) => void }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const learner = await registerLearner({ firstName, lastName, email });
      onLoggedIn(learner);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to continue');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = firstName.trim() && lastName.trim() && email.trim() && !submitting;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Who&apos;s learning?</Text>
      <Text style={styles.subtitle}>Tell us who you are so your tutor remembers you between sessions.</Text>
      <TextInput style={styles.input} placeholder="First name" value={firstName} onChangeText={setFirstName} />
      <TextInput style={styles.input} placeholder="Last name" value={lastName} onChangeText={setLastName} />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TouchableOpacity
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue</Text>}
      </TouchableOpacity>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#FBF7F0' },
  title: { fontSize: 22, fontWeight: '600', color: '#1C1810' },
  subtitle: { fontSize: 13, color: '#8B6F47', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E8DDC9', borderRadius: 6, padding: 10, backgroundColor: '#fff', color: '#1C1810' },
  button: { backgroundColor: '#C8862B', borderRadius: 6, padding: 12, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#1C1810', fontWeight: '600' },
  error: { color: '#c00', fontSize: 13 },
});
