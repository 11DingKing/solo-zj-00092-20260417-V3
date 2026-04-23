import DeleteIcon from '@mui/icons-material/Delete'
import {
  Avatar,
  Box,
  Button,
  Checkbox,
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
  Typography,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import { AxiosError } from 'axios'
import { useState, useEffect, useCallback } from 'react'
import { redirect, useLoaderData } from 'react-router'
import UserProfile from '../components/UserProfile'
import { useAuth } from '../contexts/auth'
import { useSnackBar } from '../contexts/snackbar'
import { User } from '../models/user'
import userService from '../services/user.service'

export async function loader() {
  try {
    const users = await userService.getUsers()
    return { users }
  } catch {
    return redirect('/')
  }
}

export default function Users() {
  const { users: initialUsers } = useLoaderData() as { users: User[] }
  const { user: currentUser } = useAuth()
  const { showSnackBar } = useSnackBar()
  const [users, setUsers] = useState<Array<User>>(initialUsers)
  const [selectedUser, setSelectedUser] = useState<User | undefined>()
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [toDeleteUser, setToDeleteUser] = useState<User>()
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false)
  const [openBatchDeleteDialog, setOpenBatchDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [userNotFound, setUserNotFound] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const refreshUsers = async () => {
      try {
        const refreshedUsers = await userService.getUsers()
        setUsers(refreshedUsers)
        if (selectedUser) {
          const stillExists = refreshedUsers.find((u) => u.uuid === selectedUser.uuid)
          if (!stillExists) {
            setSelectedUser(undefined)
            setUserNotFound(true)
          }
        }
      } catch (error) {
        console.error('Failed to refresh users:', error)
      }
    }
    if (refreshKey > 0) {
      refreshUsers()
    }
  }, [refreshKey, selectedUser])

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

  const deletableUsersCount = users.filter((u) => currentUser?.uuid !== u.uuid).length
  const allSelected = selectedUserIds.size === deletableUsersCount && deletableUsersCount > 0

  return (
    <Container maxWidth='lg' sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={2} justifyContent='center'>
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper>
            {selectedUserIds.size > 0 && (
              <Box sx={{ p: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider' }}>
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
              sx={{ maxHeight: 450, overflow: 'auto', '::-webkit-scrollbar': { display: 'none' } }}
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
                      <ListItemText
                        primary={user.email}
                        secondary={
                          (user.first_name || user.last_name) &&
                          user.first_name + ' ' + user.last_name
                        }
                      />
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
              />
            </Paper>
          ) : null}
        </Grid>
      </Grid>

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
