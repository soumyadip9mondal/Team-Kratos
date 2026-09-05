import React, { useState, useRef } from 'react';
import { Paperclip, X, FileText, Send, Loader2 } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function MessageInput({ onSend, isStreaming }) {
  const [text, setText] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [docType, setDocType] = useState('IDENTITY_PROOF');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFile(file);
    }
  };

  const removeFile = () => {
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if ((!text.trim() && !attachedFile) || isStreaming || isUploading) return;

    let finalPrompt = text.trim();

    if (attachedFile) {
      setIsUploading(true);
      const toastId = toast.loading(`Uploading ${attachedFile.name} to Iris...`);

      try {
        const formData = new FormData();
        formData.append('document', attachedFile);
        formData.append('title', attachedFile.name);
        formData.append('type', docType);

        const res = await axios.post(
          `${import.meta.env.VITE_API_URL || ''}/api/chatbot/documents/upload`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'multipart/form-data',
            },
          }
        );

        toast.success(`Uploaded ${attachedFile.name}! Analyzing document...`, { id: toastId });

        const fileMeta = { name: attachedFile.name, type: docType };
        if (!finalPrompt) {
          finalPrompt = `[ATTACHED_FILE:${attachedFile.name}]`;
        } else {
          finalPrompt = `[ATTACHED_FILE:${attachedFile.name}]\n${finalPrompt}`;
        }

        setAttachedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

        if (finalPrompt) {
          onSend(finalPrompt, fileMeta);
          setText('');
        }
        return;
      } catch (err) {
        console.error('File Upload Error:', err);
        toast.error(err.response?.data?.error || 'Failed to upload document to Iris.', { id: toastId });
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    if (finalPrompt) {
      onSend(finalPrompt);
      setText('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-full space-y-2">
      {/* Attached File Preview Bar */}
      {attachedFile && (
        <div className="flex items-center justify-between bg-indigo-50/90 border border-indigo-200/80 rounded-xl px-3.5 py-2 text-xs font-medium text-indigo-900 shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="p-1 bg-indigo-200/60 rounded-md text-indigo-700">
              <FileText size={15} />
            </div>
            <span className="truncate font-semibold max-w-[160px] sm:max-w-[240px]">
              {attachedFile.name}
            </span>
            <span className="text-[10px] text-indigo-600/80 font-mono">
              ({(attachedFile.size / 1024).toFixed(1)} KB)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Document Type Dropdown */}
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="bg-white border border-indigo-200 text-indigo-950 text-[11px] font-bold rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            >
              <option value="IDENTITY_PROOF">Identity Proof</option>
              <option value="ADDRESS_PROOF">Address Proof</option>
              <option value="EDUCATION_CERTIFICATE">Education Certificate</option>
              <option value="EMPLOYMENT_PROOF">Employment Proof</option>
              <option value="PAN">PAN Card</option>
              <option value="AADHAAR">Aadhaar Card</option>
            </select>

            <button
              onClick={removeFile}
              className="p-1 hover:bg-indigo-200/60 rounded-full text-indigo-700 transition-colors"
              title="Remove attachment"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Input Row */}
      <div className="flex space-x-2 sm:space-x-3 items-end">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept=".pdf,.png,.jpg,.jpeg,.docx"
          className="hidden"
        />

        {/* Paperclip Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming || isUploading}
          className="bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 border border-slate-200 rounded-2xl p-3 sm:p-3.5 flex items-center justify-center h-[48px] sm:h-[54px] w-[48px] sm:w-[54px] shadow-2xs transition-all disabled:opacity-50 shrink-0"
          title="Upload Document to Iris (PDF, Image, Word)"
        >
          <Paperclip size={18} className="sm:w-5 sm:h-5" />
        </button>

        {/* Textarea */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={attachedFile ? `Add prompt for ${attachedFile.name} (optional)...` : "Ask Iris..."}
          disabled={isStreaming || isUploading}
          className="flex-1 border border-slate-200 shadow-xs rounded-2xl p-3 sm:p-3.5 resize-none focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 min-h-[48px] sm:min-h-[54px] max-h-[120px] sm:max-h-[150px] transition-all bg-slate-50/50 focus:bg-white text-[14px] sm:text-[15px]"
          rows={1}
        />

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={(!text.trim() && !attachedFile) || isStreaming || isUploading}
          className="bg-[#0F172A] text-white rounded-2xl px-4 sm:px-5 hover:bg-[#1E293B] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center self-end h-[48px] sm:h-[54px] shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 shrink-0"
        >
          {isUploading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} className="sm:w-5 sm:h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
