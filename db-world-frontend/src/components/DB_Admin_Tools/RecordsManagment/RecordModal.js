import React, { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

function RecordModal({
    show,
    handleClose,
    isEditing,
    formData,
    handleFormChange,
    handleFormSubmit,
    resetForm,
    loadingSubmit,
    tmdbOptions,
    fetchTmdbResults,
    loadingTmdb
}) {
    return (
        <Modal show={show} onHide={handleClose}>
            <Modal.Header closeButton>
                <Modal.Title>{isEditing ? 'Edit Record' : 'Add New Record'}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form onSubmit={handleFormSubmit}>
                    {isEditing && (
                        <Form.Group className="mb-3">
                            <Form.Label>Record ID:</Form.Label>
                            <Form.Control type="text" name="recordId" value={formData.recordId} disabled />
                        </Form.Group>
                    )}
                    <Form.Group className="mb-3">
                        <Form.Label>Type:</Form.Label>
                        <Form.Control
                            as="select"
                            name="type"
                            value={formData.type}
                            onChange={handleFormChange}
                            required
                            disabled={isEditing}
                        >
                            <option value="">Select Type</option>
                            <option value="movie">Movie</option>
                            <option value="series">Series</option>
                        </Form.Control>
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Name:</Form.Label>
                        <Form.Control
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleFormChange}
                            required
                        />
                    </Form.Group>
                    <Form.Group className="mb-3" hidden={isEditing}>
                        <Form.Label>Release Year:</Form.Label>
                        <Form.Control
                            type="text"
                            name="releaseYear"
                            value={formData.releaseYear}
                            onChange={handleFormChange}
                            placeholder="Optional"
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>TMDB:</Form.Label>
                        {isEditing ? (
                            <Form.Control type="text" name="tmdb" value={formData.tmdb} disabled />
                        ) : (
                            <div className="d-flex">
                                <Form.Control
                                    as="select"
                                    name="tmdb"
                                    value={formData.tmdb}
                                    onChange={handleFormChange}
                                >
                                    <option value="">Select TMDB Record</option>
                                    {tmdbOptions.map(option => (
                                        <option key={option.id} value={option.id}>
                                            {option.title} | {option.originalTitle} | {option.releaseDate}
                                        </option>
                                    ))}
                                </Form.Control>
                                <Button
                                    variant="primary"
                                    type="button"
                                    onClick={fetchTmdbResults}
                                    disabled={loadingTmdb}
                                    className="ms-2"
                                >
                                    {loadingTmdb ? (
                                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                    ) : (
                                        'Search TMDB'
                                    )}
                                </Button>
                            </div>
                        )}
                    </Form.Group>
                    <Form.Group className="mb-3 form-check">
                        <Form.Check
                            type="checkbox"
                            name="showOnTop"
                            checked={formData.showOnTop}
                            onChange={handleFormChange}
                            label="Show On Top"
                        />
                    </Form.Group>
                    <div className="d-flex justify-content-end">
                        <Button variant="primary" type="submit" disabled={loadingSubmit}>
                            {loadingSubmit ? (
                                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                            ) : (
                                isEditing ? 'Update Record' : 'Add Record'
                            )}
                        </Button>
                        {isEditing && (
                            <Button variant="secondary" type="button" onClick={handleClose} className="ms-2">
                                Cancel
                            </Button>
                        )}
                    </div>
                </Form>
            </Modal.Body>
        </Modal>
    );
}

export default RecordModal;