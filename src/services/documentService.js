import { documents } from '../mockData/documents'
import { createMockService } from './createMockService'

export const documentService = createMockService(documents, 'id')
