'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, '이메일을 입력해주세요')
    .email('이메일 형식이 올바르지 않습니다'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const email = watch('email');

  const handleClearEmail = () => setValue('email', '');
  const togglePasswordVisibility = () => setShowPassword((v) => !v);

  const onSubmit = async (data: LoginFormData) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Login failed');

      const { accessToken, refreshToken } = await response.json();

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      document.cookie = `accessToken=${accessToken}; path=/`;
      document.cookie = `refreshToken=${refreshToken}; path=/`;

      router.push('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
      toast.error('로그인에 실패했습니다');
    }
  };

  return (
    <div className="w-full pt-[86px] px-4 sm:px-6 lg:px-8">
      <div className="w-[360px]">
        {/* 타이틀 */}
        <div className="flex flex-col gap-2">
          <h2 className="text-[40px] inter-bold font-bold text-foreground">
            Login
          </h2>
          <p className="inter-regular text-[15px] text-muted-foreground">
            로그인하고 효율적인 가게 관리를 시작해볼까요?
          </p>
        </div>

        <form className="mt-10 w-[360px]" onSubmit={handleSubmit(onSubmit)}>
          <div className="rounded-md space-y-5">
            {/* Email */}
            <div className="relative h-20">
              <label htmlFor="email" className="text-sm text-foreground">
                Email
              </label>

              <div className="relative mt-2">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  placeholder="youremail@example.com"
                  className={[
                    'appearance-none rounded-[10px] relative block w-full px-3 py-2 text-sm',
                    'bg-card text-foreground border outline-none transition',
                    errors.email ? 'border-destructive' : 'border-border',
                    'placeholder:text-muted-foreground/70',
                    'focus:ring-2 focus:ring-ring focus:border-transparent',
                  ].join(' ')}
                />

                {email && (
                  <button
                    type="button"
                    onClick={handleClearEmail}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
                    aria-label="Clear email"
                  >
                    ✕
                  </button>
                )}
              </div>

              {errors.email && (
                <p className="absolute bottom-0 text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="relative h-20">
              <label htmlFor="password" className="text-sm text-foreground">
                Password
              </label>

              <div className="relative mt-2">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...register('password')}
                  placeholder="Enter your password"
                  className={[
                    'appearance-none rounded-[10px] relative block w-full px-3 py-2 text-sm pr-10',
                    'bg-card text-foreground border outline-none transition',
                    errors.password ? 'border-destructive' : 'border-border',
                    'placeholder:text-muted-foreground/70',
                    'focus:ring-2 focus:ring-ring focus:border-transparent',
                  ].join(' ')}
                />

                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Image
                    src={showPassword ? '/Hide.svg' : '/Show.svg'}
                    alt={showPassword ? 'Hide password' : 'Show password'}
                    width={18}
                    height={18}
                    className="opacity-70 hover:opacity-100 transition"
                  />
                </button>
              </div>

              {errors.password && (
                <p className="absolute bottom-0 text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={[
              'mt-[18px] w-full flex justify-center py-2.5 px-4 rounded-[10px]',
              'text-sm font-medium bg-primary text-primary-foreground',
              'hover:opacity-95 transition',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            ].join(' ')}
          >
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <Link
          href="/signup"
          className="font-medium w-[360px] flex justify-center mt-[18px] text-foreground/80 hover:text-foreground transition"
        >
          계정이 없으신가요? <span className="underline underline-offset-4">Sign up</span>
        </Link>
      </div>
    </div>
  );
}
