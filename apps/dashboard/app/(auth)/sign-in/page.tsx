import type { Metadata } from "next";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = {
  title: "Sign In — LLMAssert",
};

export default function SignInPage() {
  return <SignInForm />;
}
