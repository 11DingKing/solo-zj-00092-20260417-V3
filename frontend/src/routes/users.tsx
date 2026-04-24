import DeleteIcon from '@mui/icons-material/Delete'
import FilterListIcon from '@mui/icons-material/FilterList'
import {
  Avatar,
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
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Paper,
  Popover,
  Typography,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import { AxiosError } from 'axios'
import { useState, useEffect, useCallback } from 'react'
import { redirect, useLoaderData } from 'react-router'
import UserProfile from '../components/UserProfile'
import { useAuth } from '../contexts/auth'
import { useSnackBar } from '../contexts/snackbar'
import { Tag } from '../models/tag'
import { User } from '../models/user'
import tagService from '../services/tag.service'
import userService from '../services/user.service'

export async function loader() {
  try {
    const [users, tags] = await Promise.all([
      userService.getUsers(),
      tagService.getTags(),
    ])
    return { users, tags }
  } catch {
    return redirect('/')
  }
}

export default function Users() {
  const { users: initialUsers, tags: initialTags } = useLoaderData() as { users: User[]; tags: Tag[] }
  const { user: currentUser } = useAuth()
  const { showSnackBar } = useSnackBar()
  const [users, setUsers] = useState<Array<User>>(initialUsers)
  const [tags, setTags] = useState<Array<Tag>>(initialTags)
  const [selectedUser, setSelectedUser] = useState<User | undefined>()
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [selectedFilterTags, setSelectedFilterTags] = useState<Set<string>>(new Set())
  const [toDeleteUser, setToDeleteUser] = useState<User>()
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false)
  const [openBatchDeleteDialog, setOpenBatchDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [userNotFound, setUserNotFound] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLButtonElement | null>(null)

  useEffect(() => {
    const refreshData = async () => {
      try {
        const tagIds = Array.from(selectedFilterTags)
        const [refreshedUsers, refreshedTags] = await Promise.all([
          userService.getUsers(tagIds.length > 0 ? tagIds : undefined),
          tagService.getTags(),
        ])
        setUsers(refreshedUsers)
        setTags(refreshedTags)
        if (selectedUser) {
          const stillExists = refreshedUsers.find((u) => u.uuid === selectedUser.uuid)
          if (!stillExists) {
            setSelectedUser(undefined)
            setUserNotFound(true)
          } else {
            setSelectedUser(stillExists)
          }
        }
      } catch (error) {
        console.error('Failed to refresh data:', error)
      }
    }
    if (refreshKey > 0) {
      refreshData()
    }
  }, [refreshKey, selectedFilterTags, selectedUser])

  const handleSelect = (user: User) => () => {
    setSelectedUser(user)
    setUserNotFound(false)
  }

  const handleUserUpdate = useCallback((update: User) => {
    setUsers((prevUsers) => prevUsers.map((user) => (user.uuid === update.uuid ? update : user)))
    setSelectedUser(update)
  }, [])

  const handleUserDelete = (user: User) => () => {
    setToDeleteUser(user)
    setOpenDeleteDialog(true)
  }

  const handleCancelDelete = () => {
    setOpenDeleteDialog(false)
    setToDeleteUser(undefined)
  }

  const handleConfirmDelete = async () => {
    if (toDeleteUser) {
      setIsDeleting(true)
      try {
        setOpenDeleteDialog(false)
        await userService.deleteUser(toDeleteUser.uuid)
        showSnackBar('User deleted successfully.', 'success')
        setUsers((prevUsers) => prevUsers.filter((user) => user.uuid !== toDeleteUser.uuid))
        if (selectedUser && selectedUser.uuid === toDeleteUser.uuid) {
          setSelectedUser(undefined)
          setUserNotFound(true)
        }
      } catch (error) {
        let msg
        if (error instanceof AxiosError && error.response && typeof error.response.data.detail === 'string')
          msg = error.response.data.detail
        else if (error instanceof Error) msg = error.message
        else msg = String(error)
        showSnackBar(msg, 'error')
      } finally {
        setIsDeleting(false)
        setToDeleteUser(undefined)
      }
    }
  }

  const handleCheckboxChange = (userId: string, checked: boolean) => {
    setSelectedUserIds((prev) => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(userId)
      } else {
        newSet.delete(userId)
      }
      return newSet
    })
  }

  const handleFilterTagToggle = (tagUuid: string) => {
    setSelectedFilterTags((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(tagUuid)) {
        newSet.delete(tagUuid)
      } else {
        newSet.add(tagUuid)
      }
      return newSet
    })
  }

  const handleClearFilters = () => {
    setSelectedFilterTags(new Set())
    setFilterAnchorEl(null)
  }

  const handleSelectAll = () => {
    const deletableUserIds = users
      .filter((u) => currentUser?.uuid !== u.uuid)
      .map((u) => u.uuid)
    if (selectedUserIds.size === deletableUserIds.length) {
      setSelectedUserIds(new Set())
    } else {
      setSelectedUserIds(new Set(deletableUserIds))
    }
  }

  const handleBatchDelete = () => {
    if (selectedUserIds.size > 0) {
      setOpenBatchDeleteDialog(true)
    }
  }

  const handleCancelBatchDelete = () => {
    setOpenBatchDeleteDialog(false)
  }

  const handleConfirmBatchDelete = async () => {
    if (selectedUserIds.size > 0) {
      setIsDeleting(true)
      try {
        setOpenBatchDeleteDialog(false)
        const idsToDelete = Array.from(selectedUserIds)
        await userService.batchDeleteUsers(idsToDelete)
        showSnackBar(`Successfully deleted ${idsToDelete.length} user(s).`, 'success')
        setUsers((prevUsers) => prevUsers.filter((user) => !selectedUserIds.has(user.uuid)))
        if (selectedUser && selectedUserIds.has(selectedUser.uuid)) {
          setSelectedUser(undefined)
          setUserNotFound(true)
        }
        setSelectedUserIds(new Set())
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

  const handleBackToList = () => {
    setSelectedUser(undefined)
    setUserNotFound(false)
    setRefreshKey((prev) => prev + 1)
  }

  const getTagByUuid = (uuid: string): Tag | undefined => {
    return tags.find((t) => t.uuid === uuid)
  }

  const deletableUsersCount = users.filter((u) => currentUser?.uuid !== u.uuid).length
  const allSelected = selectedUserIds.size === deletableUsersCount && deletableUsersCount > 0
  const filterOpen = Boolean(filterAnchorEl)

  return (
    <Container maxWidth='lg' sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={2} justifyContent='center'>
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper>
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant='subtitle2' color='text.secondary'>
                  共 {users.length} 个用户
                </Typography>
                {selectedFilterTags.size > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                    <Typography variant='body2' color='text.secondary'>
                      筛选:
                    </Typography>
                    {Array.from(selectedFilterTags).map((tagUuid) => {
                      const tag = getTagByUuid(tagUuid)
                      return tag ? (
                        <Chip
                          key={tagUuid}
                          label={tag.name}
                          size='small'
                          sx={{
                            backgroundColor: tag.color,
                            color: '#fff',
                            fontWeight: 500,
                          }}
                          onDelete={() => handleFilterTagToggle(tagUuid)}
                        />
                      ) : null
                    })}
                    <Chip
                      label='清除筛选'
                      size='small'
                      variant='outlined'
                      onClick={handleClearFilters}
                    />
                  </Box>
                )}
              </Box>
              <IconButton
                onClick={(e) => setFilterAnchorEl(e.currentTarget)}
                color={selectedFilterTags.size > 0 ? 'primary' : 'default'}
                title='按标签筛选'
              >
                <FilterListIcon />
              </IconButton>
            </Box>

            {selectedUserIds.size > 0 && (
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
                    indeterminate={selectedUserIds.size > 0 && selectedUserIds.size < deletableUsersCount}
                    onChange={handleSelectAll}
                  />
                  <Typography variant='body2' sx={{ ml: 1 }}>
                    {selectedUserIds.size} selected
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
                  {isDeleting ? 'Deleting...' : 'Delete Selected'}
                </Button>
              </Box>
            )}
            <List
              sx={{ maxHeight: 400, overflow: 'auto', '::-webkit-scrollbar': { display: 'none' } }}
            >
              {users.map((user) => {
                const isDeletable = currentUser?.uuid !== user.uuid
                return (
                  <ListItem
                    key={user.uuid}
                    secondaryAction={
                      isDeletable && (
                        <IconButton edge='end' aria-label='delete' onClick={handleUserDelete(user)}>
                          <DeleteIcon />
                        </IconButton>
                      )
                    }
                    disablePadding
                  >
                    {isDeletable && (
                      <Checkbox
                        edge='start'
                        checked={selectedUserIds.has(user.uuid)}
                        onChange={(e) => handleCheckboxChange(user.uuid, e.target.checked)}
                        sx={{ mr: 0 }}
                      />
                    )}
                    <ListItemButton
                      onClick={handleSelect(user)}
                      selected={selectedUser?.uuid === user.uuid}
                      data-testid={user.uuid}
                    >
                      <ListItemAvatar>
                        <Avatar
                          alt={user.first_name + ' ' + user.last_name}
                          src={user.picture && user.picture}
                        />
                      </ListItemAvatar>
                      <Box sx={{ flex: 1 }}>
                        <ListItemText
                          primary={user.email}
                          secondary={
                            (user.first_name || user.last_name) &&
                            user.first_name + ' ' + user.last_name
                          }
                        />
                        {user.tag_ids && user.tag_ids.length > 0 && (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                            {user.tag_ids.slice(0, 3).map((tagUuid) => {
                              const tag = getTagByUuid(tagUuid)
                              return tag ? (
                                <Chip
                                  key={tagUuid}
                                  label={tag.name}
                                  size='small'
                                  sx={{
                                    backgroundColor: tag.color,
                                    color: '#fff',
                                    fontSize: '0.65rem',
                                    height: 20,
                                  }}
                                />
                              ) : null
                            })}
                            {user.tag_ids.length > 3 && (
                              <Chip
                                label={`+${user.tag_ids.length - 3}`}
                                size='small'
                                variant='outlined'
                                sx={{ fontSize: '0.65rem', height: 20 }}
                              />
                            )}
                          </Box>
                        )}
                      </Box>
                    </ListItemButton>
                  </ListItem>
                )
              })}
            </List>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 7, lg: 5 }}>
          {userNotFound ? (
            <Paper
              sx={{
                p: 4,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
              }}
            >
              <Typography variant='h6' color='error' gutterBottom>
                用户不存在或已被删除
              </Typography>
              <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
                该用户可能已被其他管理员删除
              </Typography>
              <Button variant='contained' onClick={handleBackToList}>
                返回列表
              </Button>
            </Paper>
          ) : selectedUser ? (
            <Paper
              sx={{
                p: 2,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <UserProfile
                userProfile={selectedUser}
                onUserUpdated={handleUserUpdate}
                allowDelete={false}
                allTags={tags}
              />
            </Paper>
          ) : (
            <Box
              sx={{
                p: 4,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
              }}
            >
              <Typography variant='body1' color='text.secondary'>
                点击左侧用户查看详情
              </Typography>
            </Box>
          )}
        </Grid>
      </Grid>

      <Popover
        open={filterOpen}
        anchorEl={filterAnchorEl}
        onClose={() => setFilterAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Box sx={{ p: 2, minWidth: 300 }}>
          <Typography variant='subtitle2' sx={{ mb: 1 }}>
            按标签筛选 (AND 逻辑)
          </Typography>
          <Typography variant='caption' color='text.secondary' sx={{ mb: 2, display: 'block' }}>
            用户必须同时拥有所有选中的标签
          </Typography>
          {tags.length === 0 ? (
            <Typography variant='body2' color='text.secondary'>
              暂无标签
            </Typography>
          ) : (
            <List sx={{ maxHeight: 300, overflow: 'auto' }}>
              {tags.map((tag) => (
                <ListItem
                  key={tag.uuid}
                  onClick={() => handleFilterTagToggle(tag.uuid)}
                  sx={{ cursor: 'pointer' }}
                >
                  <Checkbox
                    edge='start'
                    checked={selectedFilterTags.has(tag.uuid)}
                    onChange={() => handleFilterTagToggle(tag.uuid)}
                  />
                  <Chip
                    label={tag.name}
                    sx={{
                      backgroundColor: tag.color,
                      color: '#fff',
                      fontWeight: 500,
                    }}
                  />
                </ListItem>
              ))}
            </List>
          )}
          {selectedFilterTags.size > 0 && (
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={handleClearFilters} size='small'>
                清除筛选
              </Button>
            </Box>
          )}
        </Box>
      </Popover>

      <Dialog
        open={openDeleteDialog}
        onClose={handleCancelDelete}
        aria-labelledby='alert-dialog-title'
        aria-describedby='alert-dialog-description'
      >
        <DialogContent>
          <DialogContentText id='alert-dialog-description'>
            Are you sure you want to delete this user ?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} autoFocus disabled={isDeleting}>
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} variant='contained' color='primary' disabled={isDeleting}>
            {isDeleting ? <CircularProgress size={20} /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openBatchDeleteDialog}
        onClose={handleCancelBatchDelete}
        aria-labelledby='batch-delete-dialog-title'
        aria-describedby='batch-delete-dialog-description'
      >
        <DialogTitle id='batch-delete-dialog-title'>确认批量删除</DialogTitle>
        <DialogContent>
          <DialogContentText id='batch-delete-dialog-description'>
            您确定要删除选中的 {selectedUserIds.size} 个用户吗？此操作不可撤销。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelBatchDelete} autoFocus disabled={isDeleting}>
            取消
          </Button>
          <Button onClick={handleConfirmBatchDelete} variant='contained' color='error' disabled={isDeleting}>
            {isDeleting ? <CircularProgress size={20} /> : '确认删除'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
