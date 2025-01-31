"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface ThreadLoadingContextType {
  isLoadingThread: boolean;
  setThreadLoading: (loading: boolean) => void;
  startThreadLoading: () => void;
  stopThreadLoading: () => void;
}

const ThreadLoadingContext = createContext<
  ThreadLoadingContextType | undefined
>(undefined);

export function ThreadLoadingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isLoadingThread, setIsLoadingThread] = useState(false);

  const setThreadLoading = useCallback((loading: boolean) => {
    setIsLoadingThread(loading);
  }, []);

  const startThreadLoading = useCallback(() => {
    setIsLoadingThread(true);
  }, []);

  const stopThreadLoading = useCallback(() => {
    setIsLoadingThread(false);
  }, []);

  return (
    <ThreadLoadingContext.Provider
      value={{
        isLoadingThread,
        setThreadLoading,
        startThreadLoading,
        stopThreadLoading,
      }}
    >
      {children}
    </ThreadLoadingContext.Provider>
  );
}

export function useThreadLoading() {
  const context = useContext(ThreadLoadingContext);
  if (context === undefined) {
    throw new Error(
      "useThreadLoading must be used within a ThreadLoadingProvider"
    );
  }
  return context;
}
