"use client";

import { useState } from "react";
import { useAuth } from "@/src/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      if (isSignUp) {
        await signUp(email, password, name);
        alert("Please check your email to confirm your account!");
      } else {
        const result = await signIn(email, password);
        console.log("Sign in result:", result);
        router.push("/(dashboard)");
      }
    } catch (error) {
      console.error("Authentication error:", error);
      setError(error instanceof Error ? error.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <div className="w-full max-w-[520px] mx-auto flex flex-col justify-center px-8">
        <div className="mb-12">
          <h1 className="text-5xl font-semibold tracking-tight">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h1>
          <p className="text-lg text-muted-foreground mt-3">
            {isSignUp ? "Sign up to get started" : "Sign in to continue"}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {isSignUp && (
            <Input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-16 text-xl px-4 rounded-lg bg-background border-muted"
              required
            />
          )}
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-16 text-xl px-4 rounded-lg bg-background border-muted"
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-16 text-xl px-4 rounded-lg bg-background border-muted"
            required
            minLength={6}
          />
          <Button 
            type="submit" 
            className="w-full h-16 text-xl font-medium rounded-lg transition-colors"
            disabled={isLoading}
          >
            {isLoading ? "..." : isSignUp ? "Sign Up" : "Sign In"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="mt-8 text-base text-muted-foreground hover:text-foreground transition-colors"
        >
          {isSignUp 
            ? "Already have an account? Sign in" 
            : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
} 