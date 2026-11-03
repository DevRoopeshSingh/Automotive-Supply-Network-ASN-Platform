import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
} from "react-native";
import { StatusBar } from "expo-status-bar";

export default function App() {
  const [isOnline, setIsOnline] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ASN Partner</Text>
        <Text style={styles.headerSubtitle}>
          Mumbai Automotive Express Logistics
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Current Driver Status</Text>
          <Text
            style={[
              styles.statusValue,
              { color: isOnline ? "#10b981" : "#f43f5e" },
            ]}
          >
            {isOnline ? "ONLINE — READY FOR ASSIGNMENTS" : "OFFLINE"}
          </Text>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              { backgroundColor: isOnline ? "#f43f5e" : "#0284c7" },
            ]}
            onPress={() => setIsOnline(!isOnline)}
          >
            <Text style={styles.toggleButtonText}>
              {isOnline ? "Go Offline" : "Go Online (Start Shift)"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Network-First 60-Minute SLA</Text>
          <Text style={styles.infoText}>
            Keep your GPS location enabled. Delivery assignments will
            automatically evaluate your pickup route and preparation timings.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  header: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 4,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  statusCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
  },
  statusLabel: {
    fontSize: 12,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: "bold",
    marginVertical: 12,
  },
  toggleButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
    marginTop: 8,
  },
  toggleButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  infoCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#38bdf8",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: "#cbd5e1",
    lineHeight: 18,
  },
});
