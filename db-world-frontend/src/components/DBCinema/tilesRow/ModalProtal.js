import ReactDOM from 'react-dom';

const ModalPortal = ({ children }) => {
  return ReactDOM.createPortal(
    children,
    document.getElementById('modal-root') // Make sure to add this div in your index.html
  );
};

export default ModalPortal;
