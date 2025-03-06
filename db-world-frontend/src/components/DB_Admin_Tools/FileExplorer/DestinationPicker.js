import { useEffect, useState } from "react";
import { getStreamMediaList } from "../../ApiServices";
import { Button, Card, Col, Row } from "react-bootstrap";

// DestinationPicker component: displays folders from the current destination path and allows navigation
const DestinationPicker = ({ destPath, setDestPath }) => {
    const [folders, setFolders] = useState([]);
    const [loadingDest, setLoadingDest] = useState(false);

    const fetchFolders = async (path) => {
        setLoadingDest(true);
        try {
            const response = await getStreamMediaList(encodeURIComponent(path));
            if (response.httpStatusCode === 200) {
                // Only folders
                setFolders(response.data.filter(f => f.isDirectory));
            }
        } catch (error) {
            console.error('Error fetching destination folders:', error);
        }
        setLoadingDest(false);
    };

    useEffect(() => {
        fetchFolders(destPath);
    }, [destPath]);

    const handleBackDest = () => {
        if (destPath === '/' || destPath === '') return;
        const parts = destPath.split('/').filter(Boolean);
        parts.pop();
        const newPath = '/' + parts.join('/');
        setDestPath(newPath === '' ? '/' : newPath);
    };

    return (
        <div>
            <Button variant="outline-primary" size="sm" onClick={handleBackDest} className="mb-2">
                Back
            </Button>
            <div className="mb-2">Current: {destPath}</div>
            {loadingDest ? (
                <div>Loading folders...</div>
            ) : (
                <Row>
                    {folders.map(folder => (
                        <Col key={folder.fileId} xs={12} className="mb-1">
                            <Card
                                className="p-2"
                                onClick={() => setDestPath(folder.filePath)}
                                style={{ cursor: 'pointer' }}
                            >
                                {folder.fileName}
                            </Card>
                        </Col>
                    ))}
                </Row>
            )}
        </div>
    )
};

export default DestinationPicker;