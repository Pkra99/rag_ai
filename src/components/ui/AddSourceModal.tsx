import { useState, FC, ChangeEvent } from 'react';
import { CloseIcon } from './Icons';
import { Source } from '../../types';

interface AddSourceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddSource: (source: Source) => void;
}

const AddSourceModal: FC<AddSourceModalProps> = ({ isOpen, onClose, onAddSource }) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch('/api/indexing', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 404) {
            throw new Error('API endpoint not found (404). Please check the file path: src/app/api/indexing/route.ts');
        }
        let errorMsg = `Server error: ${response.statusText}`;
        try {
            const errorResult = await response.json();
            errorMsg = errorResult.error || errorMsg;
        } catch (e) {
            // Response was not JSON, do nothing and use the status text
        }
        throw new Error(errorMsg);
      }
      
      const result = await response.json();
      
      if (!result.success) {
          throw new Error(result.error || 'Failed to index file.');
      }

      onAddSource(result.source);
      onClose();

    } catch (err: any) {
      setError(`An error occurred: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-[#2a2b2d] rounded-lg w-full max-w-2xl p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <CloseIcon />
        </button>
        <h2 className="text-xl font-semibold mb-4">Add a new source</h2>
        <div>
          <div className="border-2 border-dashed border-gray-500 rounded-lg p-10 text-center">
            {isLoading ? (
              <div>
                <p>Indexing your file... This may take a moment.</p>
                <div className="w-6 h-6 border-t-2 border-blue-500 rounded-full animate-spin mx-auto mt-4"></div>
              </div>
            ) : (
              <>
                <p className="mb-4">Drag & drop a PDF file here or</p>
                <label htmlFor="file-upload" className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-md">
                  Browse file
                </label>
                <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".pdf" />
                <p className="text-xs text-gray-400 mt-4">Supported file type: PDF</p>
                {error && <p className="text-red-500 text-sm mt-4 break-words">{error}</p>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddSourceModal;