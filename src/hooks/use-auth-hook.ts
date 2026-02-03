import { useContext } from "react";
import { AuthContextType } from "./useAuth"; // Assuming AuthContextType is exported from useAuth.tsx
import { AuthContext } from "./useAuth"; // Assuming AuthContext is exported from useAuth.tsx

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
