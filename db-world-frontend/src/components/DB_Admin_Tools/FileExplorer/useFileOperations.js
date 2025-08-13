import { useState } from 'react';
import { deleteFileApi, moveFileApi, renameFileApi } from '../../ApiServices';
import Constants from '../../Constants';
import { toast } from '../../Toast';


const useFileOperations = () => {
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleOpenModal = (type) => {
    switch (type) {
      case 'rename':
        setShowRenameModal(true);
        break;
      case 'delete':
        setShowDeleteModal(true);
        break;
      case 'info':
        setShowInfoModal(true);
        break;
      case 'move':
        setShowMoveModal(true);
        break;
      case 'copy':
        setShowCopyModal(true);
        break;
      default:
        break;
    }
  };

  const handleCloseModal = (type) => {
    switch (type) {
      case 'rename':
        setShowRenameModal(false);
        break;
      case 'delete':
        setShowDeleteModal(false);
        break;
      case 'info':
        setShowInfoModal(false);
        break;
      case 'move':
        setShowMoveModal(false);
        break;
      case 'copy':
        setShowCopyModal(false);
        break;
      default:
        break;
    }
    setSelectedFile(null);
  };

  const handleFileAction = async ({ action, file, destination, newName, onSuccess }) => {
    try {
      let response;
      switch (action) {
        case 'rename':
          response = await renameFileApi(file.id, { newName });
          break;
        case 'move':
          response = await moveFileApi(file.id, { newDirectory: destination });
          break;
        case 'delete':
          response = await deleteFileApi(file.id);
          break;
        case 'copy':
          // Implement copy API call here
          break;
        default:
          break;
      }

      if (response?.httpStatusCode === 200) {
        toast.success(response.message);
        onSuccess?.();
      } else {
        toast.error(response?.message || response?.errorMessage || 'Operation failed');
      }
    } catch (error) {
      console.error('Error performing file operation:', error);
      toast.error('Operation failed');
    }
  };

  return {
    showRenameModal,
    showDeleteModal,
    showInfoModal,
    showMoveModal,
    showCopyModal,
    selectedFile,
    setSelectedFile,
    handleOpenModal,
    handleCloseModal,
    handleFileAction
  };
};

export default useFileOperations;