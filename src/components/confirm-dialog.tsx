"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ConfirmDialogProps = {
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "destructive" | "default";
  trigger: React.ReactNode;
  action: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
  children?: React.ReactNode;
};

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Delete",
  variant = "default",
  trigger,
  action,
  children,
}: ConfirmDialogProps) {
  const handleAction = async (formData: FormData) => {
    await action(formData);
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={handleAction}>
            {children}
            <AlertDialogAction type="submit" variant={variant}>
              {confirmLabel}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
