import {Result} from '@/request/Result'
import {post} from '@/request/index'

export const parseCsv = (file: File): Promise<Result<any>> => {
  const formData = new FormData()
  formData.append('file', file)
  return post('/form_node/parse_csv', formData)
}
