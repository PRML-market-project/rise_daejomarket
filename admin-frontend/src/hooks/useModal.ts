import { useState } from 'react';

export default function useModal<T = undefined>() {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<T>();

  const open = (data?: T) => {
    setData(data);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setData(undefined);
  };

  return { isOpen, open, close, data };
}
