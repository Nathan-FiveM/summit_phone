import React from 'react';
import './ConfirmationDialog.scss';

interface ConfirmationDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmationDialog({
    isOpen,
    title,
    message,
    confirmText = 'Yes',
    cancelText = 'No',
    onConfirm,
    onCancel
}: ConfirmationDialogProps) {
    if (!isOpen) return null;

    return (
        <div className="confirmation-overlay">
            <div className="confirmation-dialog">
                <div className="confirmation-header">
                    <h3>{title}</h3>
                </div>
                
                <div className="confirmation-content">
                    <p>{message}</p>
                </div>
                
                <div className="confirmation-actions">
                    <button 
                        className="confirmation-btn cancel-btn"
                        onClick={onCancel}
                    >
                        {cancelText}
                    </button>
                    <button 
                        className="confirmation-btn confirm-btn"
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
