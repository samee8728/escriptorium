import axios from "axios";
import { getFilterParams, getSortParam, ontologyMap } from "./util";

// retrieve the full list of documents, with filters/sort
export const retrieveDocumentsList = async ({
    projectId,
    field,
    direction,
    filters,
}) => {
    let params = {};
    if (projectId) {
        params.project = projectId;
    }
    if (field && direction) {
        params.ordering = getSortParam({ field, direction });
    }
    if (filters) {
        params = { ...params, ...getFilterParams({ filters }) };
    }
    return await axios.get("/documents", { params });
};

// retrieve single document by ID
export const retrieveDocument = async (documentId) =>
    await axios.get(`/documents/${documentId}`);

// retrieve types list for a specific transcription on a document
export const retrieveTranscriptionOntology = async ({
    documentId,
    transcriptionId,
    category,
    sortField,
    sortDirection,
}) => {
    let params = {};
    if (sortField && sortDirection) {
        params.ordering = getSortParam({
            field: sortField,
            direction: sortDirection,
        });
    }
    return await axios.get(
        `/documents/${documentId}/transcriptions/${transcriptionId}/types/${ontologyMap[category]}`,
        { params },
    );
};

// retrieve characters, sorted by character or frequency, for a specific transcription on a document
export const retrieveTranscriptionCharacters = async ({
    documentId,
    transcriptionId,
    field,
    direction,
}) => {
    let params = {};
    if (field && direction) {
        params.ordering = getSortParam({ field, direction });
    }
    return await axios.get(
        `/documents/${documentId}/transcriptions/${transcriptionId}/characters`,
        { params },
    );
};

// retrieve the total number of characters in a specific transcription level on a document
export const retrieveTranscriptionCharCount = async ({
    documentId,
    transcriptionId,
}) => {
    return await axios.get(
        `/documents/${documentId}/transcriptions/${transcriptionId}/character_count`,
    );
};

// retrieve document parts
export const retrieveDocumentParts = async ({
    documentId,
    field,
    direction,
}) => {
    let params = {};
    if (field && direction) {
        params.ordering = getSortParam({ field, direction });
    }
    return await axios.get(`/documents/${documentId}/parts`, { params });
};
// create a new document
export const createDocument = async ({
    name,
    project,
    mainScript,
    readDirection,
    linePosition,
    tags,
}) =>
    await axios.post("/documents", {
        params: {
            name,
            project,
            main_script: mainScript,
            read_direction: readDirection,
            line_offset: linePosition,
            tags,
        },
    });

// delete a document
export const deleteDocument = async ({ documentId }) =>
    await axios.delete(`/documents/${documentId}`);

// edit a document
export const editDocument = async (
    documentId,
    { name, project, mainScript, readDirection, linePosition, tags },
) =>
    await axios.put(`/documents/${documentId}`, {
        params: {
            name,
            project,
            main_script: mainScript,
            read_direction: readDirection,
            line_offset: linePosition,
            tags,
        },
    });

// retrieve document metadata
export const retrieveDocumentMetadata = async (documentId) =>
    await axios.get(`/documents/${documentId}/metadata`);

// create document metadata
export const createDocumentMetadata = async ({ documentId, metadatum }) =>
    await axios.post(`/documents/${documentId}/metadata`, {
        params: metadatum,
    });

// update document metadata
export const updateDocumentMetadata = async ({ documentId, metadatum }) =>
    await axios.put(`/documents/${documentId}/metadata/${metadatum.pk}`, {
        params: metadatum,
    });

// delete document metadata
export const deleteDocumentMetadata = async ({ documentId, metadatumId }) =>
    await axios.delete(`/documents/${documentId}/metadata/${metadatumId}`);

// retrieve document models
export const retrieveDocumentModels = async (documentId) =>
    await axios.get("/models", {
        params: {
            documents: documentId,
        },
    });

// share this document with a group or user
export const shareDocument = async ({ documentId, group, user }) =>
    await axios.post(`/documents/${documentId}/share`, {
        params: { group, user },
    });
