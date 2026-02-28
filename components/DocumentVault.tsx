'use client';

import React, { useState, useCallback, useRef } from 'react';
import { api } from '@/convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';

/**
 * Document Vault Upload Component
 * 
 * Provides:
 * - Drag and drop file upload
 * - Document type selection
 * - Progress indication
 * - Integration with OCR extraction
 */
export function DocumentVault({
  returnId,
  taxpayerId,
  onUploadComplete,
}: {
  returnId: string;
  taxpayerId?: string;
  onUploadComplete?: (fileId: string, documentType: string) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('W2');
  const [selectedTaxpayer, setSelectedTaxpayer] = useState<string>('primary');
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{
    fileId: string;
    filename: string;
    documentType: string;
    status: string;
  }>>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload mutation
  const uploadFile = useMutation(api.files.uploadVaultFile);
  
  // List files for this return
  const files = useQuery(api.files.listFilesForReturn, { returnId });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await handleFileUpload(files[0]);
    }
  }, [selectedDocumentType, selectedTaxpayer, returnId, taxpayerId]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFileUpload(files[0]);
    }
  }, [selectedDocumentType, selectedTaxpayer, returnId, taxpayerId]);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Validate file type
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload PNG, JPEG, or PDF files.');
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new Error('File too large. Maximum size is 10MB.');
      }

      // Read file as base64
      const reader = new FileReader();
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Simulate progress
      setUploadProgress(30);

      // Upload to Convex
      const result = await uploadFile({
        returnId,
        taxpayerId: taxpayerId || '',
        filename: file.name,
        mimeType: file.type,
        dataBase64: fileBase64,
        documentType: selectedDocumentType,
        associatedTaxpayer: selectedTaxpayer,
      });

      setUploadProgress(100);

      if (result.success) {
        setUploadedFiles(prev => [...prev, {
          fileId: result.fileId!,
          filename: file.name,
          documentType: selectedDocumentType,
          status: 'uploaded',
        }]);
        
        onUploadComplete?.(result.fileId!, selectedDocumentType);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="document-vault">
      {/* Upload Zone */}
      <div
        className={`upload-zone ${isDragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={!uploading ? triggerFileInput : undefined}
        style={{
          border: '2px dashed #ccc',
          borderRadius: '8px',
          padding: '32px',
          textAlign: 'center',
          cursor: uploading ? 'default' : 'pointer',
          transition: 'all 0.2s ease',
          backgroundColor: isDragging ? '#f0f9ff' : 'white',
          borderColor: isDragging ? '#0ea5e9' : '#ccc',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,application/pdf"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {uploading ? (
          <div className="upload-progress">
            <div style={{ marginBottom: '8px' }}>Uploading...</div>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#e5e7eb',
              borderRadius: '4px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${uploadProgress}%`,
                height: '100%',
                backgroundColor: '#0ea5e9',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
            <div style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>
              Drop your document here
            </div>
            <div style={{ color: '#6b7280', fontSize: '14px' }}>
              or click to browse • PNG, JPEG, PDF supported
            </div>
          </>
        )}
      </div>

      {/* Document Type Selection */}
      <div style={{ marginTop: '24px' }}>
        <label style={{ 
          display: 'block', 
          fontSize: '14px', 
          fontWeight: '500', 
          marginBottom: '8px',
          color: '#374151'
        }}>
          Document Type
        </label>
        <select
          value={selectedDocumentType}
          onChange={(e) => setSelectedDocumentType(e.target.value)}
          disabled={uploading}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            fontSize: '14px',
            backgroundColor: 'white',
          }}
        >
          <option value="W2">W-2 (Wage and Tax Statement)</option>
          <option value="1099-MISC">1099-MISC (Miscellaneous Income)</option>
          <option value="1099-NEC">1099-NEC (Nonemployee Compensation)</option>
          <option value="1099-DIV">1099-DIV (Dividends)</option>
          <option value="1099-INT">1099-INT (Interest Income)</option>
          <option value="ID">Driver's License / ID</option>
          <option value="SSN">Social Security Card</option>
          <option value="OTHER">Other Document</option>
        </select>
      </div>

      {/* Taxpayer Selection (for Married Filing Joint) */}
      <div style={{ marginTop: '16px' }}>
        <label style={{ 
          display: 'block', 
          fontSize: '14px', 
          fontWeight: '500', 
          marginBottom: '8px',
          color: '#374151'
        }}>
          Associated With
        </label>
        <select
          value={selectedTaxpayer}
          onChange={(e) => setSelectedTaxpayer(e.target.value)}
          disabled={uploading}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            fontSize: '14px',
            backgroundColor: 'white',
          }}
        >
          <option value="primary">Primary Taxpayer</option>
          <option value="spouse">Spouse</option>
          <option value="dependent">Dependent</option>
        </select>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          color: '#dc2626',
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
            Uploaded Documents
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {uploadedFiles.map((file, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '24px' }}>📄</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>{file.filename}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>{file.documentType}</div>
                  </div>
                </div>
                <span style={{
                  fontSize: '12px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: file.status === 'uploaded' ? '#d1fae5' : '#fef3c7',
                  color: file.status === 'uploaded' ? '#065f46' : '#92400e',
                }}>
                  {file.status === 'uploaded' ? 'Ready' : 'Processing'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Vault Explorer Component
 * 
 * Displays uploaded documents with secure viewing
 */
export function VaultExplorer({
  returnId,
  onViewDocument,
}: {
  returnId: string;
  onViewDocument?: (fileId: string) => void;
}) {
  const files = useQuery(api.files.listFilesForReturn, { returnId });

  if (!files || files.length === 0) {
    return (
      <div style={{
        padding: '32px',
        textAlign: 'center',
        color: '#6b7280',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗄️</div>
        <div>No documents in vault</div>
        <div style={{ fontSize: '14px', marginTop: '8px' }}>
          Upload W-2s, 1099s, and IDs to get started
        </div>
      </div>
    );
  }

  // Group files by document type
  const filesByType = files.reduce((acc: Record<string, typeof files>, file: any) => {
    const type = file.documentType || 'OTHER';
    if (!acc[type]) acc[type] = [];
    acc[type].push(file);
    return acc;
  }, {});

  return (
    <div className="vault-explorer">
      {Object.entries(filesByType).map(([type, typeFiles]) => (
        <div key={type} style={{ marginBottom: '24px' }}>
          <h3 style={{ 
            fontSize: '14px', 
            fontWeight: '600', 
            color: '#374151',
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {type.replace('_', '-')} ({typeFiles.length})
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {typeFiles.map((file: any) => (
              <div
                key={file._id}
                onClick={() => onViewDocument?.(file._id)}
                style={{
                  padding: '16px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#0ea5e9';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
                <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                  {file.filename}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {file.associatedTaxpayer || 'Primary'}
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px' }}>
                  {new Date(file.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default DocumentVault;
