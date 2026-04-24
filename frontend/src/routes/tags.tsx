import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import { AxiosError } from 'axios'
import { useState, useEffect } from 'react'
import { redirect, useLoaderData } from 'react-router'
import { useAuth } from '../contexts/auth'
import { useSnackBar } from '../contexts/snackbar'
import { Tag } from '../models/tag'
import tagService from '../services/tag.service'

const COLOR_OPTIONS = [
  '#1976d2',
  '#388e3c',
  '#d32f2f',
  '#ed6c02',
  '#7b1fa2',
  '#0288d1',
  '#2e7d32',
  '#c2185b',
  '#f57c00',
  '#689f38',
  '#0097a7',
  '#5d4037',
]

export async function loader() {
  try {
    const tags = await tagService.getTags()
    return { tags }
  } catch {
    return redirect('/')
  }
}

export default function Tags() {
  const { tags: initialTags } = useLoaderData() as { tags: Tag[] }
  const { user: currentUser } = useAuth()
  const { showSnackBar } = useSnackBar()
  const [tags, setTags] = useState<Array<Tag>>(initialTags)
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set())
  const [openCreateDialog, setOpenCreateDialog] = useState(false)
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false)
  const [openBatchDeleteDialog, setOpenBatchDeleteDialog] = useState(false)
  const [toDeleteTag, setToDeleteTag] = useState<Tag>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(COLOR_OPTIONS[0])
  const [nameError, setNameError] = useState('')

  const refreshTags = async () => {
    try {
      const refreshedTags = await tagService.getTags()
      setTags(refreshedTags)
    } catch (error) {
      console.error('Failed to refresh tags:', error)
    }
  }

  const handleOpenCreate = () => {
    setNewTagName('')
    setNewTagColor(COLOR_OPTIONS[0])
    setNameError('')
    setOpenCreateDialog(true)
  }

  const handleCloseCreate = () => {
    setOpenCreateDialog(false)
    setNewTagName('')
    setNewTagColor(COLOR_OPTIONS[0])
    setNameError('')
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      setNameError('标签名称不能为空')
      return
    }

    setIsSubmitting(true)
    try {
      const createdTag = await tagService.createTag({
        name: newTagName.trim(),
        color: newTagColor,
      })
      setTags((prev) => [createdTag, ...prev])
      showSnackBar('标签创建成功', 'success')
      handleCloseCreate()
    } catch (error) {
      if (
        error instanceof AxiosError &&
        error.response &&
        error.response.status === 409 &&
        typeof error.response.data.detail === 'string'
      ) {
        setNameError(error.response.data.detail)
      } else if (
        error instanceof AxiosError &&
        error.response &&
        typeof error.response.data.detail === 'string'
      ) {
        showSnackBar(error.response.data.detail, 'error')
      } else if (error instanceof Error) {
        showSnackBar(error.message, 'error')
      } else {
        showSnackBar(String(error), 'error')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTagDelete = (tag: Tag) => () => {
    setToDeleteTag(tag)
    setOpenDeleteDialog(true)
  }

  const handleCancelDelete = () => {
    setOpenDeleteDialog(false)
    setToDeleteTag(undefined)
  }

  const handleConfirmDelete = async () => {
    if (toDeleteTag) {
      setIsDeleting(true)
      try {
        setOpenDeleteDialog(false)
        await tagService.deleteTag(toDeleteTag.uuid)
        showSnackBar('标签删除成功', 'success')
        setTags((prevTags) => prevTags.filter((tag) => tag.uuid !== toDeleteTag.uuid))
        setSelectedTagIds((prev) => {
          const newSet = new Set(prev)
          newSet.delete(toDeleteTag.uuid)
          return newSet
        })
      } catch (error) {
        let msg
        if (error instanceof AxiosError && error.response && typeof error.response.data.detail === 'string')
          msg = error.response.data.detail
        else if (error instanceof Error) msg = error.message
        else msg = String(error)
        showSnackBar(msg, 'error')
      } finally {
        setIsDeleting(false)
        setToDeleteTag(undefined)
      }
    }
  }

  const handleCheckboxChange = (tagId: string, checked: boolean) => {
    setSelectedTagIds((prev) => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(tagId)
      } else {
        newSet.delete(tagId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    const allTagUuids = tags.map((t) => t.uuid)
    if (selectedTagIds.size === allTagUuids.length) {
      setSelectedTagIds(new Set())
    } else {
      setSelectedTagIds(new Set(allTagUuids))
    }
  }

  const handleBatchDelete = () => {
    if (selectedTagIds.size > 0) {
      setOpenBatchDeleteDialog(true)
    }
  }

  const handleCancelBatchDelete = () => {
    setOpenBatchDeleteDialog(false)
  }

  const handleConfirmBatchDelete = async () => {
    if (selectedTagIds.size > 0) {
      setIsDeleting(true)
      try {
        setOpenBatchDeleteDialog(false)
        const idsToDelete = Array.from(selectedTagIds)
        await tagService.batchDeleteTags(idsToDelete)
        showSnackBar(`成功删除 ${idsToDelete.length} 个标签`, 'success')
        setTags((prevTags) => prevTags.filter((tag) => !selectedTagIds.has(tag.uuid)))
        setSelectedTagIds(new Set())
      } catch (error) {
        let msg
        if (error instanceof AxiosError && error.response && typeof error.response.data.detail === 'string')
          msg = error.response.data.detail
        else if (error instanceof Error) msg = error.message
        else msg = String(error)
        showSnackBar(msg, 'error')
      } finally {
        setIsDeleting(false)
      }
    }
  }

  const allSelected = selectedTagIds.size === tags.length && tags.length > 0

  return (
    <Container maxWidth='md' sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={2} justifyContent='center'>
        <Grid size={{ xs: 12 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant='h5'>标签管理</Typography>
            <Button
              variant='contained'
              startIcon={<AddIcon />}
              onClick={handleOpenCreate}
            >
              新建标签
            </Button>
          </Box>

          <Paper>
            {selectedTagIds.size > 0 && (
              <Box
                sx={{
                  p: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Checkbox
                    checked={allSelected}
                    indeterminate={selectedTagIds.size > 0 && selectedTagIds.size < tags.length}
                    onChange={handleSelectAll}
                  />
                  <Typography variant='body2' sx={{ ml: 1 }}>
                    已选择 {selectedTagIds.size} 个
                  </Typography>
                </Box>
                <Button
                  variant='contained'
                  color='error'
                  size='small'
                  startIcon={isDeleting ? <CircularProgress size={16} color='inherit' /> : <DeleteIcon />}
                  onClick={handleBatchDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? '删除中...' : '删除选中'}
                </Button>
              </Box>
            )}

            {tags.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant='body1' color='text.secondary'>
                  暂无标签，点击上方按钮创建第一个标签
                </Typography>
              </Box>
            ) : (
              <List
                sx={{
                  maxHeight: 500,
                  overflow: 'auto',
                  '::-webkit-scrollbar': { display: 'none' },
                }}
              >
                {tags.map((tag) => (
                  <ListItem
                    key={tag.uuid}
                    secondaryAction={
                      <Tooltip title='删除标签'>
                        <IconButton edge='end' aria-label='delete' onClick={handleTagDelete(tag)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    }
                    disablePadding
                  >
                    <Checkbox
                      edge='start'
                      checked={selectedTagIds.has(tag.uuid)}
                      onChange={(e) => handleCheckboxChange(tag.uuid, e.target.checked)}
                      sx={{ mr: 0 }}
                    />
                    <ListItemButton>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={tag.name}
                              sx={{
                                backgroundColor: tag.color,
                                color: '#fff',
                                fontWeight: 500,
                              }}
                            />
                          </Box>
                        }
                        secondary={
                          <Typography variant='caption' color='text.secondary'>
                            创建于 {new Date(tag.created_at).toLocaleDateString('zh-CN')}
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Dialog
        open={openCreateDialog}
        onClose={handleCloseCreate}
        aria-labelledby='create-tag-dialog-title'
      >
        <DialogTitle id='create-tag-dialog-title'>创建新标签</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, minWidth: 400 }}>
            <TextField
              autoFocus
              margin='dense'
              id='name'
              label='标签名称'
              type='text'
              fullWidth
              variant='standard'
              value={newTagName}
              onChange={(e) => {
                setNewTagName(e.target.value)
                setNameError('')
              }}
              error={!!nameError}
              helperText={nameError}
              disabled={isSubmitting}
            />
            <Box sx={{ mt: 2 }}>
              <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
                选择颜色
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {COLOR_OPTIONS.map((color) => (
                  <Tooltip key={color} title={color}>
                    <Box
                      onClick={() => !isSubmitting && setNewTagColor(color)}
                      sx={{
                        width: 36,
                        height: 36,
                        backgroundColor: color,
                        borderRadius: '50%',
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        border: newTagColor === color ? '3px solid rgba(0, 0, 0, 0.54)' : '2px solid transparent',
                        '&:hover': {
                          opacity: 0.8,
                        },
                      }}
                    />
                  </Tooltip>
                ))}
              </Box>
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant='body2' color='text.secondary'>
                  预览:
                </Typography>
                <Chip
                  label={newTagName || '标签名称'}
                  sx={{
                    backgroundColor: newTagColor,
                    color: '#fff',
                    fontWeight: 500,
                  }}
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreate} disabled={isSubmitting}>
            取消
          </Button>
          <Button
            onClick={handleCreateTag}
            variant='contained'
            disabled={isSubmitting || !newTagName.trim()}
          >
            {isSubmitting ? <CircularProgress size={20} /> : '创建'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openDeleteDialog}
        onClose={handleCancelDelete}
        aria-labelledby='delete-tag-dialog-title'
        aria-describedby='delete-tag-dialog-description'
      >
        <DialogTitle id='delete-tag-dialog-title'>确认删除</DialogTitle>
        <DialogContent>
          <DialogContentText id='delete-tag-dialog-description'>
            确定要删除标签 "
            <Chip
              label={toDeleteTag?.name}
              sx={{
                backgroundColor: toDeleteTag?.color,
                color: '#fff',
                fontWeight: 500,
              }}
            />
            " 吗？此操作将同时移除所有用户关联的此标签。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} autoFocus disabled={isDeleting}>
            取消
          </Button>
          <Button
            onClick={handleConfirmDelete}
            variant='contained'
            color='error'
            disabled={isDeleting}
          >
            {isDeleting ? <CircularProgress size={20} /> : '确认删除'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openBatchDeleteDialog}
        onClose={handleCancelBatchDelete}
        aria-labelledby='batch-delete-tag-dialog-title'
        aria-describedby='batch-delete-tag-dialog-description'
      >
        <DialogTitle id='batch-delete-tag-dialog-title'>确认批量删除</DialogTitle>
        <DialogContent>
          <DialogContentText id='batch-delete-tag-dialog-description'>
            确定要删除选中的 {selectedTagIds.size} 个标签吗？此操作将同时移除所有用户关联的这些标签，且不可撤销。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelBatchDelete} autoFocus disabled={isDeleting}>
            取消
          </Button>
          <Button
            onClick={handleConfirmBatchDelete}
            variant='contained'
            color='error'
            disabled={isDeleting}
          >
            {isDeleting ? <CircularProgress size={20} /> : '确认删除'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
