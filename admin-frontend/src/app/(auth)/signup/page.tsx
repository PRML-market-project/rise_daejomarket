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
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        }
      );

      if (!response.ok) {
        throw new Error('이메일 인증번호 발송에 실패했습니다.');
      }

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
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            authNum: verificationCode,
          }),
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
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            storeName: storeName,
            storeNameEn: storeNameEn,
          }),
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

  const handleClearName = () => {
    setValue('name', '');
  };

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
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            adminName: data.name,
            storeName: data.storeName,
            storeNameEn: data.storeNameEn,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('회원가입에 실패했습니다.');
      }

      toast('회원가입이 완료되었습니다.');
      router.push('/login');
    } catch (error: any) {
      console.error('Sign-up failed:', error);
      toast(error.message || '회원가입에 실패했습니다.');
    }
  };

  return (
    <div className='min-h-screen flex justify-center bg-white px-4 sm:px-6 lg:px-8 text-sm'>
      <div className=''>
        <div>
          <div className='flex flex-col gap-2'>
            <h2 className='text-[40px] inter-bold font-bold  text-indigo-900'>
              Sign up
            </h2>
            <p className='inter-regular text-[15px] text-indigo-700'>
              가입하고 효율적인 가게 관리를 시작해볼까요?
            </p>
          </div>
        </div>
        <form
          className='mt-2 gap-4 w-[360px]'
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className='rounded-md'>
            <div className='relative h-20 flex flex-col gap-2'>
              <label htmlFor='name' className='text-indigo-900'>
                Your Name
              </label>
              <div className='relative'>
                <input
                  id='name'
                  type='text'
                  {...register('name')}
                  className={`appearance-none rounded-[8px] relative h-[46px] block w-full px-3 py-2 border ${
                    errors.name ? 'border-red-300' : 'border-indigo-300'
                  } placeholder-indigo-300 text-indigo-900 focus:outline-none focus:border-indigo-300 focus:z-10 sm:text-sm`}
                  placeholder='홍길동'
                />
                {name && (
                  <button
                    type='button'
                    onClick={handleClearName}
                    className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10'
                  >
                    ✕
                  </button>
                )}
              </div>
              {errors.name && (
                <p className='absolute bottom-[-12px] text-sm text-red-600'>
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className='flex gap-3 items-center'>
              <div className='flex flex-col mt-2'>
                <div className='relative h-20'>
                  <label htmlFor='storeName' className='text-indigo-900'>
                    Store Name (Korean)
                  </label>

                  <input
                    id='storeName'
                    type='text'
                    {...register('storeName')}
                    className={`appearance-none rounded-[8px] relative block w-[265px] h-[46px] px-3 py-2 border ${
                      errors.storeName ? 'border-red-300' : 'border-indigo-300'
                    } placeholder-indigo-300 text-indigo-900 focus:outline-none focus:border-indigo-300 focus:z-10 sm:text-sm`}
                    placeholder='Store Name (Korean)'
                  />

                  {errors.storeName && (
                    <p className='absolute bottom-0 text-sm text-red-600'>
                      {errors.storeName.message}
                    </p>
                  )}
                </div>
                <div className='relative h-20'>
                  <label htmlFor='storeNameEn' className='text-indigo-900'>
                    Store Name (English)
                  </label>
                  <input
                    id='storeNameEn'
                    type='text'
                    {...register('storeNameEn')}
                    className={`appearance-none rounded-[8px] relative block w-[265px] h-[46px] px-3 py-2 border ${
                      errors.storeNameEn
                        ? 'border-red-300'
                        : 'border-indigo-300'
                    } placeholder-indigo-300 text-indigo-900 focus:outline-none focus:border-indigo-300 focus:z-10 sm:text-sm`}
                    placeholder='Store Name (English)'
                  />
                  {errors.storeNameEn && (
                    <p className='absolute bottom-0 text-sm text-red-600'>
                      {errors.storeNameEn.message}
                    </p>
                  )}
                </div>
              </div>

              <button
                type='button'
                onClick={handleStoreNameCheck}
                disabled={!storeName || !storeNameEn || isStoreNameChecked}
                className='border flex-1 hover:cursor-pointer border-indigo-600 rounded-[8px] h-[46px] px-2 py-2.5 font-normal text-indigo-600 bg-white focus:outline-none focus:ring-2 focus:ring-offset-2  disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {isStoreNameChecked ? '확인완료' : '중복확인'}
              </button>
            </div>
            <div className='relative h-20'>
              <label htmlFor='email' className='text-indigo-900'>
                Email
              </label>
              <div className='flex gap-3'>
                <input
                  id='email'
                  type='email'
                  autoComplete='email'
                  {...register('email')}
                  className={`appearance-none rounded-[8px] relative block w-[265px] px-3 py-2 border ${
                    errors.email ? 'border-red-300' : 'border-indigo-300'
                  } placeholder-indigo-300 text-indigo-900 focus:outline-none focus:border-indigo-300 focus:z-10 sm:text-sm`}
                  placeholder='youremail@example.com'
                />
                <button
                  type='button'
                  onClick={handleEmailVerification}
                  disabled={!email || isEmailVerified}
                  className='hover:cursor-pointer border border-indigo-600 rounded-[8px] px-2 py-2.5 font-normal text-indigo-600 bg-white focus:outline-none focus:ring-2 focus:ring-offset-2  disabled:opacity-50 disabled:cursor-not-allowed flex-1'
                >
                  {isEmailVerified ? '인증완료' : '인증하기'}
                </button>
              </div>
              {errors.email && (
                <p className='absolute bottom-0 text-sm text-red-600'>
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className='relative h-20'>
              <label htmlFor='verificationCode' className='text-indigo-900'>
                Verification Code
              </label>
              <div className='flex gap-3'>
                <input
                  id='verificationCode'
                  disabled={!showVerificationInput}
                  type='text'
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className='appearance-none rounded-[8px] relative block w-[265px] px-3 py-2 border border-indigo-300 placeholder-indigo-300 text-indigo-900 focus:outline-none focus:border-indigo-300 focus:z-10 sm:text-sm disabled:placeholder-ml-gray disabled:cursor-not-allowed'
                  placeholder='인증번호 6자리를 입력해주세요'
                />
                <button
                  type='button'
                  onClick={handleVerifyCode}
                  disabled={!showVerificationInput}
                  className='hover:cursor-pointer border border-indigo-600 rounded-[8px] px-2 py-2.5 font-normal flex-1 text-indigo-600 bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  확인
                </button>
              </div>
            </div>
            <div className='relative h-20'>
              <label htmlFor='password' className='text-indigo-900'>
                Password
              </label>
              <input
                id='password'
                type='password'
                autoComplete='new-password'
                {...register('password')}
                className={`appearance-none h-[46px] rounded-[8px] relative block w-full px-3 py-2 border ${
                  errors.password ? 'border-red-300' : 'border-indigo-300'
                } placeholder-indigo-300 text-indigo-900 focus:outline-none focus:border-indigo-300 focus:z-10 sm:text-sm`}
                placeholder='영문, 숫자, 하나 이상의 특수문자를 포함하는 8 ~ 16자'
              />
              {errors.password && (
                <p className='absolute bottom-0 text-sm text-red-600'>
                  {errors.password.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <button
              type='submit'
              disabled={isSubmitting}
              className='hover:cursor-pointer mt-[18px] group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {isSubmitting ? 'Signing up...' : 'Sign up'}
            </button>
          </div>
        </form>
        <Link
          href='/login'
          className='font-medium text-indigo-600 w-[360px] flex justify-center mt-[18px]'
        >
          이미 회원이신가요? Login
        </Link>
      </div>
    </div>
  );
}
