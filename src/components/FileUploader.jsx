export default function FileUploader({ onFileSelected, currentFileName, hasSavedProgress }) {
  return (
    <label className="inline-flex cursor-pointer items-center justify-center rounded-md bg-stone-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-stone-950">
      <input
        className="sr-only"
        type="file"
        accept="application/pdf"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileSelected(file);
        }}
      />
      {currentFileName ? 'Open another PDF' : hasSavedProgress ? 'Open PDF to resume' : 'Open PDF'}
    </label>
  );
}
