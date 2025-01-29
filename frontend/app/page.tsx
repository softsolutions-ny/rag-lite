"use client";

import Image from "next/image";
import { useSignIn, useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import googleIcon from "@/public/google-icon.svg";
import appleIcon from "@/public/apple-icon.svg";
import githubIcon from "@/public/github-icon.svg";

export default function Home() {
  const { signIn, isLoaded } = useSignIn();
  const { isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn) {
      router.push("/dashboard/chat");
    }
  }, [isSignedIn, router]);

  if (!isLoaded) return null;

  const signInWith = (
    strategy: "oauth_google" | "oauth_apple" | "oauth_github"
  ) => {
    signIn.authenticateWithRedirect({
      strategy,
      redirectUrl: "/sso-callback",
      redirectUrlComplete: "/dashboard/chat",
    });
  };

  return (
    <div className="min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)] dark:text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">elucide</h1>
          </div>
          <p className="text-sm text-muted-foreground dark:text-gray-400">
            graphical user interface for robot intelligence
          </p>
          <div className="h-2"></div>
          <div className="flex gap-2">
            <button
              onClick={() => signInWith("oauth_google")}
              className="p-1.5 border rounded-lg hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 transition-colors"
            >
              <Image
                src={googleIcon}
                alt="Google Icon"
                width={16}
                height={16}
                className="dark:invert"
              />
            </button>
            <button
              onClick={() => signInWith("oauth_apple")}
              className="p-1.5 border rounded-lg hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 transition-colors"
            >
              <Image
                src={appleIcon}
                alt="Apple Icon"
                width={16}
                height={16}
                className="dark:invert"
              />
            </button>
            <button
              onClick={() => signInWith("oauth_github")}
              className="p-1.5 border rounded-lg hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 transition-colors"
            >
              <Image
                src={githubIcon}
                alt="GitHub Icon"
                width={16}
                height={16}
                className="dark:invert"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
