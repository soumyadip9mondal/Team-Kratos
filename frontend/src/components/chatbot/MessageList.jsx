import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, Paperclip } from 'lucide-react';
import InlineIrisCard from './InlineIrisCard';
import IrisDocumentVerificationCard from './IrisDocumentVerificationCard';

export default function MessageList({ messages, isLoading, onSendMessage }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-transparent">
        <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-[13px] text-slate-500 font-semibold tracking-wide animate-pulse uppercase">Loading history...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-4 md:p-6 space-y-6 sm:space-y-8 bg-transparent w-full [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/50">
      {messages.map((m, idx) => (
        <div key={m.id || idx} className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {m.role === 'model' && (
             <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-[#0F172A] border border-[#1E293B] flex items-center justify-center shadow-sm shrink-0 mr-2 sm:mr-4 mt-1">
               <Bot size={14} className="text-white sm:hidden" />
               <Bot size={18} className="text-white hidden sm:block" />
             </div>
          )}
          <div 
            className={`max-w-[92%] sm:max-w-[85%] md:max-w-[80%] rounded-2xl px-4 py-3 sm:px-5 sm:py-4 ${
              m.role === 'user' 
                ? 'bg-gradient-to-tr from-slate-800 to-slate-900 text-white shadow-md rounded-tr-sm' 
                : 'bg-white text-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/80 rounded-tl-sm'
            }`}
          >
            {m.id === 'thinking' ? (
              <div className="flex items-center space-x-2 text-indigo-500 text-[13px] font-semibold italic py-2">
                <span className="animate-pulse text-indigo-600">●</span>
                <span className="animate-pulse text-indigo-500" style={{animationDelay: '0.2s'}}>●</span>
                <span className="animate-pulse text-indigo-400" style={{animationDelay: '0.4s'}}>●</span>
                <span className="ml-2 text-slate-500 not-italic">Investigating...</span>
              </div>
            ) : m.role === 'model' && m.content.trim().endsWith('...') && m.content.length < 100 ? (
              <div className="flex items-center space-x-3 text-slate-700 py-1">
                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-[14.5px] font-medium animate-pulse">{m.content.trim()}</span>
              </div>
            ) : m.role === 'model' ? (
              <div className="prose prose-sm prose-slate max-w-none prose-p:leading-relaxed prose-pre:bg-slate-800 prose-pre:text-slate-100 prose-a:text-indigo-600 hover:prose-a:text-indigo-500 prose-strong:text-slate-900 prose-headings:text-slate-900">
                {(() => {
                  const parts = m.content.split(/(\[IRIS_ACTION_CARD:[a-zA-Z0-9-]+\]|\[IRIS_DOCUMENT_CARD:.*?\])/g);
                  const cards = [];
                  const docCards = [];
                  const texts = [];
                  
                  parts.forEach((part, i) => {
                    if (part.startsWith('[IRIS_ACTION_CARD:')) {
                      const taskId = part.replace('[IRIS_ACTION_CARD:', '').replace(']', '');
                      cards.push(<InlineIrisCard key={`card-${i}`} taskId={taskId} />);
                    } else if (part.startsWith('[IRIS_DOCUMENT_CARD:')) {
                      try {
                        const jsonStr = part.replace('[IRIS_DOCUMENT_CARD:', '').slice(0, -1);
                        const docData = JSON.parse(jsonStr);
                        docCards.push(
                          <IrisDocumentVerificationCard
                            key={`doc-card-${i}`}
                            documentData={docData}
                            onActionTriggered={onSendMessage}
                          />
                        );
                      } catch (err) {
                        console.error('Failed to parse document card json', err);
                      }
                    } else {
                      texts.push(
                        <ReactMarkdown key={`text-${i}`} remarkPlugins={[remarkGfm]}>
                          {part}
                        </ReactMarkdown>
                      );
                    }
                  });

                  return (
                    <div className="flex flex-col">
                      <div>{texts}</div>
                      {docCards.length > 0 && <div className="mt-4">{docCards}</div>}
                      {cards.length > 0 && <div className="mt-4">{cards}</div>}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-[14.5px] leading-relaxed font-medium">
                {(() => {
                  let textContent = m.content || '';
                  let fileName = m.attachedFile?.name;

                  if (textContent.startsWith('[ATTACHED_FILE:')) {
                    const match = textContent.match(/^\[ATTACHED_FILE:(.*?)\](?:\n(.*))?$/s);
                    if (match) {
                      fileName = fileName || match[1];
                      textContent = match[2] || '';
                    }
                  }

                  return (
                    <div className="flex flex-col items-start gap-1.5">
                      {fileName && (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/15 border border-white/25 rounded-xl text-xs font-semibold text-white shadow-xs">
                          <Paperclip size={13} className="text-indigo-200" />
                          <span>{fileName}</span>
                        </div>
                      )}
                      {textContent ? <div>{textContent}</div> : null}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
