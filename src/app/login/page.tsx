"use client";

import { useState, useEffect } from "react";
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
  const { signIn, signUp, user } = useAuth();

  // Redirect if user is already authenticated
  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (isSignUp) {
        const result = await signUp(email, password, name);
        
        if (result.user?.email_confirmed_at) {
          // User is confirmed immediately, will redirect via useEffect
        } else {
          // User needs email confirmation
          setIsLoading(false);
          alert("Please check your email to confirm your account!");
          return;
        }
      } else {
        const result = await signIn(email, password);
        
        if (result.user) {
          // Authentication successful, will redirect via useEffect when user state updates
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "An unknown error occurred");
      setIsLoading(false);
    }
    // Don't set loading to false here if authentication was successful
    // Let the useEffect handle the redirect and loading will be managed by the redirect
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
            {isLoading ? "Signing in..." : isSignUp ? "Sign Up" : "Sign In"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError("");
          }}
          className="mt-8 text-base text-muted-foreground hover:text-foreground transition-colors"
          disabled={isLoading}
        >
          {isSignUp 
            ? "Already have an account? Sign in" 
            : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
} 