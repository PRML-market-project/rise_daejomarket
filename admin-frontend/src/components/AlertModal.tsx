'use client';

import { Dialog, DialogBackdrop } from '@headlessui/react';
import { useEffect, useState } from 'react';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
}

export default function AlertModal({
  isOpen,
  onClose,
  onConfirm,
  message,
}: AlertModalProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setIsMounted(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isMounted) return null;

  return (
    <Dialog
      open={true}
      onClose={onClose}
      className='fixed z-50 inset-0 flex items-center justify-center'
    >
      {/* Backdrop with fade animation */}
      <DialogBackdrop
        className={`fixed inset-0 bg-black/30 transition-opacity duration-200 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Modal panel with slide-up animation */}
      <div
        className={`bg-white rounded-xl p-6 z-50 shadow-xl w-[90%] max-w-md transform transition-all duration-200 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <Dialog.Title className='text-lg font-semibold mb-4'>확인</Dialog.Title>
        <p className='mb-6'>{message}</p>
        <div className='flex justify-end gap-4'>
          <button
            onClick={onClose}
            className='px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 hover:cursor-pointer transition-colors'
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className='px-4 py-2 rounded bg-indigo-500 text-white hover:bg-indigo-600 hover:cursor-pointer transition-colors'
          >
            확인
          </button>
        </div>
      </div>
    </Dialog>
  );
}
