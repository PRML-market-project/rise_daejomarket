"use client";

import { useRouter } from "next/navigation";
import AdminLogin from "../../../../../frontend/ml-test-main/src/features/admin/AdminLogin";

export default function LoginPage() {
  const router = useRouter();
  return <AdminLogin onAuthenticated={() => { router.push("/dashboard"); router.refresh(); }} />;
}
