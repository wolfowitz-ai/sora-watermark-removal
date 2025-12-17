import UploadDropzone from "../UploadDropzone";

export default function UploadDropzoneExample() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <UploadDropzone onFilesSelected={(files) => console.log("Files:", files)} />
    </div>
  );
}
