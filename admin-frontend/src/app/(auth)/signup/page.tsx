'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

const signUpSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요'),
  storeName: z.string().min(1, '가게 이름을 입력해주세요'),
  storeNameEn: z.string().min(1, '가게 영문 이름을 입력해주세요'),
  email: z
    .string()
    .min(1, '이메일을 입력해주세요')
    .email('이메일 형식이 올바르지 않습니다'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
});

type SignUpFormData = z.infer<typeof signUpSchema>;

export default function SignUp() {
  const router = useRouter();
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isStoreNameChecked, setIsStoreNameChecked] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerificationInput, setShowVerificationInput] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  });

  const email = watch('email');
  const storeName = watch('storeName');
  const storeNameEn = watch('storeNameEn');
  const name = watch('name');

  const handleEmailVerification = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/emailSend`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        }
      );

      if (!response.ok) throw new Error('이메일 인증번호 발송에 실패했습니다.');

      setShowVerificationInput(true);
      toast('인증번호가 전송되었습니다');
    } catch (error: any) {
      console.error('Email verification failed:', error);
      toast.error('이메일 인증번호 발송에 실패했습니다');
    }
  };

  const handleVerifyCode = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/emailCheck`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, authNum: verificationCode }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '인증번호가 일치하지 않습니다.');
      }

      setIsEmailVerified(true);
      setShowVerificationInput(false);
      toast('이메일 인증에 성공했습니다.');
    } catch (error: any) {
      console.error('Code verification failed:', error);
      toast.error(error.message || '인증번호 확인에 실패했습니다');
    }
  };

  const handleStoreNameCheck = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/checkStoreName`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storeName, storeNameEn }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '이미 사용중인 가게 이름입니다.');
      }

      setIsStoreNameChecked(true);
      toast('사용 가능한 가게 이름입니다.');
    } catch (error: any) {
      console.error('Store name check failed:', error);
      toast.error(error.message || '가게 이름 중복 확인에 실패했습니다.');
    }
  };

  const handleClearName = () => setValue('name', '');

  const onSubmit = async (data: SignUpFormData) => {
    if (!isEmailVerified) {
      toast.error('이메일 인증이 필요합니다.');
      return;
    }
    if (!isStoreNameChecked) {
      toast.error('가게 이름 중복 확인이 필요합니다.');
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/join`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            adminName: data.name,
            storeName: data.storeName,
            storeNameEn: data.storeNameEn,
          }),
        }
      );

      if (!response.ok) throw new Error('회원가입에 실패했습니다.');

      toast('회원가입이 완료되었습니다.');
      router.push('/login');
    } catch (error: any) {
      console.error('Sign-up failed:', error);
      toast(error.message || '회원가입에 실패했습니다.');
    }
  };

  const inputBase =
    'appearance-none rounded-[10px] relative block px-3 py-2 text-sm h-[46px] bg-card text-foreground border outline-none transition placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring focus:border-transparent';

  const outlineBtn =
    'border rounded-[10px] h-[46px] px-4 min-w-[88px] py-2.5 font-normal bg-card text-foreground/85 hover:text-foreground hover:bg-accent transition focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed';  return (
    
    <div className="w-full px-4 sm:px-6 lg:px-8 text-sm pt-14">
      <div className="w-[360px]">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h2 className="text-[40px] inter-bold font-bold text-foreground">
            Sign up
          </h2>
          <p className="inter-regular text-[15px] text-muted-foreground">
            가입하고 효율적인 가게 관리를 시작해볼까요?
          </p>
        </div>

        <form className="mt-2 w-[360px]" onSubmit={handleSubmit(onSubmit)}>
          <div className="rounded-md space-y-4">
            {/* Name */}
            <div className="relative h-20 flex flex-col gap-2">
              <label htmlFor="name" className="text-sm text-foreground">
                Your Name
              </label>

              <div className="relative">
                <input
                  id="name"
                  type="text"
                  {...register('name')}
                  className={[
                    inputBase,
                    'w-full',
                    errors.name ? 'border-destructive' : 'border-border',
                  ].join(' ')}
                  placeholder="홍길동"
                />

                {name && (
                  <button
                    type="button"
                    onClick={handleClearName}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
                    aria-label="Clear name"
                  >
                    ✕
                  </button>
                )}
              </div>

              {errors.name && (
                <p className="absolute bottom-[-12px] text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Store name + check */}
            <div className="flex gap-3 items-start">
              <div className="flex flex-col mt-2 gap-4">
                <div className="relative h-20">
                  <label htmlFor="storeName" className="text-sm text-foreground">
                    Store Name (Korean)
                  </label>

                  <input
                    id="storeName"
                    type="text"
                    {...register('storeName')}
                    className={[
                      inputBase,
                      'w-[240px]',
                      errors.storeName ? 'border-destructive' : 'border-border',
                    ].join(' ')}
                    placeholder="Store Name (Korean)"
                  />

                  {errors.storeName && (
                    <p className="absolute bottom-0 text-sm text-destructive">
                      {errors.storeName.message}
                    </p>
                  )}
                </div>

                <div className="relative h-20">
                  <label
                    htmlFor="storeNameEn"
                    className="text-sm text-foreground"
                  >
                    Store Name (English)
                  </label>

                  <input
                    id="storeNameEn"
                    type="text"
                    {...register('storeNameEn')}
                    className={[
                      inputBase,
                      'w-[240px]',
                      errors.storeNameEn
                        ? 'border-destructive'
                        : 'border-border',
                    ].join(' ')}
                    placeholder="Store Name (English)"
                  />

                  {errors.storeNameEn && (
                    <p className="absolute bottom-0 text-sm text-destructive">
                      {errors.storeNameEn.message}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleStoreNameCheck}
                disabled={!storeName || !storeNameEn || isStoreNameChecked}
                className={[outlineBtn, 'flex-1 mt-[90px]'].join(' ')}
              >
                {isStoreNameChecked ? '확인완료' : '중복확인'}
              </button>
            </div>

            {/* Email + send */}
            <div className="relative h-20">
              <label htmlFor="email" className="text-sm text-foreground">
                Email
              </label>

              <div className="flex gap-3 mt-2">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  className={[
                    inputBase,
                    'w-[240px]',
                    errors.email ? 'border-destructive' : 'border-border',
                  ].join(' ')}
                  placeholder="youremail@example.com"
                />

                <button
                  type="button"
                  onClick={handleEmailVerification}
                  disabled={!email || isEmailVerified}
                  className={[outlineBtn, 'flex-1'].join(' ')}
                >
                  {isEmailVerified ? '인증완료' : '인증하기'}
                </button>
              </div>

              {errors.email && (
                <p className="absolute bottom-0 text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Verification code */}
            <div className="relative h-20">
              <label
                htmlFor="verificationCode"
                className="text-sm text-foreground"
              >
                Verification Code
              </label>

              <div className="flex gap-3 mt-2">
                <input
                  id="verificationCode"
                  disabled={!showVerificationInput}
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className={[
                    inputBase,
                    'w-[265px]',
                    'disabled:opacity-60 disabled:cursor-not-allowed',
                  ].join(' ')}
                  placeholder="인증번호 6자리를 입력해주세요"
                />

                <button
                  type="button"
                  onClick={handleVerifyCode}
                  disabled={!showVerificationInput}
                  className={[outlineBtn, 'flex-1'].join(' ')}
                >
                  확인
                </button>
              </div>
            </div>

            {/* Password */}
            <div className="relative h-20">
              <label htmlFor="password" className="text-sm text-foreground">
                Password
              </label>

              <input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register('password')}
                className={[
                  inputBase,
                  'w-full mt-2',
                  errors.password ? 'border-destructive' : 'border-border',
                ].join(' ')}
                placeholder="영문, 숫자, 하나 이상의 특수문자를 포함"
              />

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
            {isSubmitting ? 'Signing up...' : 'Sign up'}
          </button>
        </form>

        <Link
          href="/login"
          className="font-medium w-[360px] flex justify-center mt-[18px] text-foreground/80 hover:text-foreground transition"
        >
          <span>이미 회원이신가요?</span>
          <span className="underline underline-offset-4">Login</span>
        </Link>
      </div>
    </div>
  );
}
