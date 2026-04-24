import axios from 'axios'
import { Tag, TagCreate, TagUpdate } from '../models/tag'

const API_URL = import.meta.env.VITE_BACKEND_API_URL

class TagService {
  async getTags(): Promise<Array<Tag>> {
    const response = await axios.get(API_URL + 'tags')
    return response.data
  }

  async getTag(tagUuid: string): Promise<Tag> {
    const response = await axios.get(API_URL + `tags/${tagUuid}`)
    return response.data
  }

  async createTag(tagData: TagCreate): Promise<Tag> {
    const response = await axios.post(API_URL + 'tags', tagData)
    return response.data
  }

  async updateTag(tagUuid: string, tagData: TagUpdate): Promise<Tag> {
    const response = await axios.patch(API_URL + `tags/${tagUuid}`, tagData)
    return response.data
  }

  async deleteTag(tagUuid: string): Promise<Tag> {
    const response = await axios.delete(API_URL + `tags/${tagUuid}`)
    return response.data
  }

  async batchDeleteTags(tagUuids: string[]): Promise<Array<Tag>> {
    const response = await axios.post(API_URL + 'tags/batch-delete', tagUuids)
    return response.data
  }
}

export default new TagService()
