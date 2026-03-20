"use client";

import * as React from "react";

type OrgContextValue = {
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: "admin" | "member";
};

const OrgContext = React.createContext<OrgContextValue | null>(null);

type OrgProviderProps = {
  children: React.ReactNode;
  value: OrgContextValue;
};

export function OrgProvider({ children, value }: OrgProviderProps) {
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg(): OrgContextValue {
  const context = React.useContext(OrgContext);
  if (!context) {
    throw new Error("useOrg must be used within OrgProvider");
  }
  return context;
}
