export function Footer() {
  return (
    <footer className="border-t py-8">
      <div className="flex items-center justify-between">
        <a href="/blog" className="text-sm">Read more</a>
        <div className="flex gap-4">{/* social links go here */}</div>
      </div>
    </footer>
  );
}
