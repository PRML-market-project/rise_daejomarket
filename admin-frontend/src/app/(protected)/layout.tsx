import NavigationBar from '@/components/NavigationBar';

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className='w-screen h-screen relative flex justify-center items-center bg-indigo-100  text-indigo-900'>
      <NavigationBar />
      {children}
    </div>
  );
}
