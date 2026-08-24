export default function EmptyReader({ hasSavedProgress }) {
  return (
    <div className="grid h-full place-items-center px-4">
      <div className="max-w-md text-center">
        <p className="text-lg font-semibold text-stone-950">
          {hasSavedProgress ? 'Open the same PDF to continue.' : 'Open a PDF to start reading.'}
        </p>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          Progress is saved locally for each file.
        </p>
      </div>
    </div>
  );
}
