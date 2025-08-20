import { FC } from 'react';
import { Source } from '../../types';
import { PanelIcon, PlusIcon, DiscoverIcon, FileIcon } from '../ui/Icons';

interface SourcesPanelProps {
  openModal: () => void;
  sources: Source[];
}

const SourcesPanel: FC<SourcesPanelProps> = ({ openModal, sources }) => (
  <aside className="w-1/3 bg-[#2a2b2d] rounded-lg p-4 flex flex-col">
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-lg font-semibold">Sources</h2>
      <PanelIcon />
    </div>
    <div className="flex gap-2 mb-4">
      <button onClick={openModal} className="flex-1 flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-500 rounded-md py-2 text-sm">
        <PlusIcon /> Add
      </button>
      <button className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 rounded-md py-2 text-sm">
        <DiscoverIcon /> Discover
      </button>
    </div>
    <div className="flex-grow overflow-y-auto">
      {sources.length === 0 ? (
        <div className="text-center text-gray-400 mt-16">
          <FileIcon />
          <p className="mt-4 font-semibold">Saved sources will appear here</p>
          <p className="text-xs mt-2">Click Add source above to add PDFs, websites, text, videos or audio files.</p>
        </div>
      ) : (
        <ul>
          {sources.map(source => (
            <li key={source.id} className="bg-gray-700 p-3 rounded-md mb-2">
              <p className="font-semibold text-sm truncate">{source.name}</p>
              <p className="text-xs text-gray-400">{source.type}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  </aside>
);

export default SourcesPanel;