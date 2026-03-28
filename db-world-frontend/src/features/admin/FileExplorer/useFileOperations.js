import { useState, useCallback, useRef } from 'react';
import { 
  deleteFileApi, 
  moveFileApi, 
  renameFileApi, 
  copyFileApi,
  createFolderApi 
} from '../../ApiServices';
import Constants from '../../Constants';
import { toast } from '../../Toast';

const useFileOperations = () => {
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [operationProgress, setOperationProgress] = useState(0);
  const [operationType, setOperationType] = useState(null);
  
  const abortControllerRef = useRef(null);

  // Operation types for tracking
  const OPERATION_TYPES = {
    RENAME: 'rename',
    DELETE: 'delete',
    MOVE: 'move',
    COPY: 'copy',
    CREATE: 'create',
    INFO: 'info'
  };

  // Animation timing constants
  const ANIMATION_TIMING = {
    SUCCESS_TOAST: 3000,
    ERROR_TOAST: 5000,
    PROGRESS_UPDATE_INTERVAL: 100,
    MIN_PROGRESS_DURATION: 500
  };

  // Simulate progress for better UX
  const simulateProgress = useCallback(() => {
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) {
          clearInterval(interval);
          setOperationProgress(100);
          setTimeout(() => {
            setOperationProgress(0);
            resolve();
          }, 300);
        } else {
          setOperationProgress(progress);
        }
      }, ANIMATION_TIMING.PROGRESS_UPDATE_INTERVAL);
    });
  }, []);

  // Handle modal operations with animation
  const handleOpenModal = useCallback((type, file = null) => {
    if (file) {
      setSelectedFile(file);
    }
    
    setOperationType(type);
    
    // Add animation delay for modal opening
    setTimeout(() => {
      switch (type) {
        case OPERATION_TYPES.RENAME:
          setShowRenameModal(true);
          break;
        case OPERATION_TYPES.DELETE:
          setShowDeleteModal(true);
          break;
        case OPERATION_TYPES.INFO:
          setShowInfoModal(true);
          break;
        case OPERATION_TYPES.MOVE:
          setShowMoveModal(true);
          break;
        case OPERATION_TYPES.COPY:
          setShowCopyModal(true);
          break;
        case OPERATION_TYPES.CREATE:
          setShowCreateModal(true);
          break;
        default:
          break;
      }
    }, 100);
  }, []);

  const handleCloseModal = useCallback((type) => {
    // Animate modal closing
    switch (type) {
      case OPERATION_TYPES.RENAME:
        setShowRenameModal(false);
        break;
      case OPERATION_TYPES.DELETE:
        setShowDeleteModal(false);
        break;
      case OPERATION_TYPES.INFO:
        setShowInfoModal(false);
        break;
      case OPERATION_TYPES.MOVE:
        setShowMoveModal(false);
        break;
      case OPERATION_TYPES.COPY:
        setShowCopyModal(false);
        break;
      case OPERATION_TYPES.CREATE:
        setShowCreateModal(false);
        break;
      default:
        break;
    }
    
    // Reset after animation completes
    setTimeout(() => {
      setSelectedFile(null);
      setOperationType(null);
      setOperationProgress(0);
      setIsProcessing(false);
    }, 300);
  }, []);

  // Cancel ongoing operation
  const cancelOperation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setOperationProgress(0);
    toast.info('Operation cancelled');
  }, []);

  // Validate file operation inputs
  const validateOperation = useCallback((action, file, destination, newName) => {
    const errors = [];

    if (!file) {
      errors.push('No file selected');
      return { isValid: false, errors };
    }

    switch (action) {
      case OPERATION_TYPES.RENAME:
        if (!newName || newName.trim() === '') {
          errors.push('New name cannot be empty');
        }
        if (newName.match(/[<>:"/\\|?*]/)) {
          errors.push('Name contains invalid characters');
        }
        if (newName.length > 255) {
          errors.push('Name is too long (max 255 characters)');
        }
        break;

      case OPERATION_TYPES.MOVE:
      case OPERATION_TYPES.COPY:
        if (!destination || destination.trim() === '') {
          errors.push('Destination cannot be empty');
        }
        if (destination === file.filePath) {
          errors.push('Cannot move/copy to the same location');
        }
        break;

      case OPERATION_TYPES.DELETE:
        if (!file.id) {
          errors.push('File ID is required');
        }
        break;

      case OPERATION_TYPES.CREATE:
        if (!newName || newName.trim() === '') {
          errors.push('Folder name cannot be empty');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }, []);

  // Format error messages for display
  const formatErrorMessage = useCallback((error, defaultMessage = 'Operation failed') => {
    if (error?.response?.data?.errorMessage) {
      return error.response.data.errorMessage;
    }
    if (error?.message) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return defaultMessage;
  }, []);

  // Handle success with celebration effects
  const handleSuccess = useCallback((message, onSuccess) => {
    // Show success toast with celebration effect
    toast.success(message, {
      autoClose: ANIMATION_TIMING.SUCCESS_TOAST,
      position: 'top-center',
      style: {
        background: 'linear-gradient(135deg, #00c853, #64dd17)',
        color: 'white',
        fontWeight: 'bold',
      }
    });

    // Trigger success callback after animation
    setTimeout(() => {
      onSuccess?.();
    }, 500);
  }, []);

  // Handle file action with enhanced features
  const handleFileAction = useCallback(async ({ 
    action, 
    file, 
    destination, 
    newName, 
    onSuccess,
    onError 
  }) => {
    // Validation
    const validation = validateOperation(action, file, destination, newName);
    if (!validation.isValid) {
      toast.error(validation.errors.join(', '));
      return;
    }

    // Cancel any ongoing operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    setIsProcessing(true);
    setOperationType(action);

    try {
      // Start progress simulation
      const progressPromise = simulateProgress();

      let response;
      const apiConfig = {
        signal: abortControllerRef.current.signal,
        timeout: 30000 // 30 second timeout
      };

      // Execute operation based on type
      switch (action) {
        case OPERATION_TYPES.RENAME:
          response = await renameFileApi(file.id, { newName }, apiConfig);
          break;
        case OPERATION_TYPES.MOVE:
          response = await moveFileApi(file.id, { newDirectory: destination }, apiConfig);
          break;
        case OPERATION_TYPES.DELETE:
          response = await deleteFileApi(file.id, apiConfig);
          break;
        case OPERATION_TYPES.COPY:
          response = await moveFileApi(file.id, { destination }, apiConfig);
          break;
        case OPERATION_TYPES.CREATE:
          // response = await createFolderApi(destination, newName, apiConfig);
          break;
        default:
          throw new Error('Unsupported operation');
      }

      // Wait for progress to complete
      await progressPromise;

      // Handle response
      if (response?.httpStatusCode === 200) {
        handleSuccess(response.message || 'Operation completed successfully', onSuccess);
      } else if (response?.httpStatusCode === 401 || response?.httpStatusCode === 403) {
        toast.error('Unauthorized access. Please log in again.', {
          autoClose: ANIMATION_TIMING.ERROR_TOAST,
        });
        // Redirect to login if needed
        setTimeout(() => {
          window.location.href = Constants.LOGIN_ROUTE;
        }, 2000);
      } else {
        const errorMsg = response?.message || response?.errorMessage || 'Operation failed';
        toast.error(errorMsg, {
          autoClose: ANIMATION_TIMING.ERROR_TOAST,
        });
        onError?.(errorMsg);
      }

    } catch (error) {
      // Handle specific error types
      if (error.name === 'AbortError') {
        toast.info('Operation was cancelled');
      } else if (error.name === 'TimeoutError') {
        toast.error('Operation timed out. Please try again.', {
          autoClose: ANIMATION_TIMING.ERROR_TOAST,
        });
      } else if (error.code === 'NETWORK_ERROR') {
        toast.error('Network error. Please check your connection.', {
          autoClose: ANIMATION_TIMING.ERROR_TOAST,
        });
      } else {
        const errorMessage = formatErrorMessage(error);
        toast.error(errorMessage, {
          autoClose: ANIMATION_TIMING.ERROR_TOAST,
        });
        onError?.(error);
      }
      
      console.error(`Error performing ${action} operation:`, error);
      
    } finally {
      // Cleanup
      abortControllerRef.current = null;
      setIsProcessing(false);
      setOperationProgress(0);
      
      // Close modal if not cancelled
      // if (error?.name !== 'AbortError') {
        handleCloseModal(action);
      // }
    }
  }, [validateOperation, simulateProgress, handleSuccess, formatErrorMessage, handleCloseModal]);

  // Get operation status for UI
  const getOperationStatus = useCallback(() => ({
    isProcessing,
    progress: operationProgress,
    type: operationType,
    currentFile: selectedFile,
    canCancel: abortControllerRef.current !== null,
  }), [isProcessing, operationProgress, operationType, selectedFile]);

  // Batch operations for multiple files
  const handleBatchOperation = useCallback(async ({ 
    action, 
    files, 
    destination, 
    onSuccess,
    onProgress 
  }) => {
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Update progress for batch
      const progress = ((i + 1) / files.length) * 100;
      onProgress?.(progress, i + 1, files.length);

      try {
        await handleFileAction({
          action,
          file,
          destination,
          onSuccess: () => {
            results.success++;
          },
          onError: (error) => {
            results.failed++;
            results.errors.push({
              file: file.fileName,
              error: error?.message || 'Unknown error'
            });
          }
        });
      } catch (error) {
        results.failed++;
        results.errors.push({
          file: file.fileName,
          error: error?.message || 'Unknown error'
        });
      }
    }

    // Show batch results
    if (results.success > 0) {
      toast.success(`Successfully processed ${results.success} file${results.success !== 1 ? 's' : ''}`);
    }
    if (results.failed > 0) {
      toast.error(`Failed to process ${results.failed} file${results.failed !== 1 ? 's' : ''}`);
    }

    onSuccess?.(results);
  }, [handleFileAction]);

  return {
    // Modal states
    showRenameModal,
    showDeleteModal,
    showInfoModal,
    showMoveModal,
    showCopyModal,
    showCreateModal,
    
    // File states
    selectedFile,
    setSelectedFile,
    
    // Operation states
    isProcessing,
    operationProgress,
    operationType,
    
    // Operation types constants
    OPERATION_TYPES,
    
    // Handlers
    handleOpenModal,
    handleCloseModal,
    handleFileAction,
    handleBatchOperation,
    cancelOperation,
    
    // Status getter
    getOperationStatus,
    
    // Utilities
    validateOperation
  };
};

export default useFileOperations;