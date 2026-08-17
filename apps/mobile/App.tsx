import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LoginScreen } from './src/screens/LoginScreen';
import { LessonScreen } from './src/screens/LessonScreen';
import { type Learner, getStoredLearner } from './src/lib/learner';

const DEMO_LESSON_SLUG = 'variables-and-types';

export default function App() {
  const [learner, setLearner] = useState<Learner | null | undefined>(undefined); // undefined = not checked yet

  useEffect(() => {
    getStoredLearner().then(setLearner);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      {learner === undefined ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : learner === null ? (
        <LoginScreen onLoggedIn={setLearner} />
      ) : (
        <LessonScreen learner={learner} slug={DEMO_LESSON_SLUG} />
      )}
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
