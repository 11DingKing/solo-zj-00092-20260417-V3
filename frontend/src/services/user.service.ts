import axios from 'axios'
import { User } from '../models/user'

const API_URL = import.meta.env.VITE_BACKEND_API_URL

class UserService {
  async getProfile(): Promise<User> {
    const response = await axios.get(API_URL + 'users/me')
    return response.data
  }

  async updateProfile(profile: User): Promise<User> {
    const response = await axios.patch(API_URL + 'users/me', profile)
    return response.data
  }

  async updateUser(userId: string, profile: User): Promise<User> {
    const response = await axios.patch(API_URL + `users/${userId}`, profile)
    return response.data
  }

  async getUsers(tagIds?: string[]): Promise<Array<User>> {
    let url = API_URL + 'users'
    if (tagIds && tagIds.length > 0) {
      const queryString = tagIds.map((id) => `tag_ids=${encodeURIComponent(id)}`).join('&')
      url += `?${queryString}`
    }
    const response = await axios.get(url)
    return response.data
  }

  async deleteUser(userId: string) {
    const response = await axios.delete(API_URL + `users/${userId}`)
    return response.data
  }

  async batchDeleteUsers(userIds: string[]): Promise<Array<User>> {
    const response = await axios.post(API_URL + 'users/batch-delete', userIds)
    return response.data
  }

  async deleteSelf() {
    const response = await axios.delete(API_URL + 'users/me')
    return response.data
  }

  async addTagsToUser(userId: string, tagUuids: string[]): Promise<User> {
    const response = await axios.post(API_URL + `users/${userId}/tags`, tagUuids)
    return response.data
  }

  async removeTagFromUser(userId: string, tagUuid: string): Promise<User> {
    const response = await axios.delete(API_URL + `users/${userId}/tags/${tagUuid}`)
    return response.data
  }
}

export default new UserService()
