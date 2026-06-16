interface PageHeaderProps {
  title: string;
  onBack?: () => void;
}

export default function PageHeader({ title, onBack }: PageHeaderProps) {
  return (
    <header className="flex items-center h-14 px-4 bg-white border-b border-gray-100">
      {onBack && (
        <button onClick={onBack} className="mr-3 p-1">
          {/* TODO: 뒤로가기 아이콘 */}
        </button>
      )}
      <h2 className="text-base font-semibold text-gray-800">{title}</h2>
    </header>
  );
}
