import type { Metadata } from "next";
import { SignUpForm } from "./SignUpForm";

export const metadata: Metadata = {
  title: "Sign Up — LLMAssert",
};

export default function SignUpPage() {
  return <SignUpForm />;
}
