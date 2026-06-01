import { post } from '@/api'

export const parseCsv = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return post('/api/application/form_node/parse_csv', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}
