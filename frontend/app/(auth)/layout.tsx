export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">BeFlex Helpdesk</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Customer Support System</p>
        </div>
        {children}
      </div>
    </div>
  );
}
