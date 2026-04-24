import AddIcon from '@mui/icons-material/Add'
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  Popover,
  TextField,
  Typography,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import { AxiosError } from 'axios'
import { useEffect, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { useAuth } from '../contexts/auth'
import { useSnackBar } from '../contexts/snackbar'
import { Tag } from '../models/tag'
import { User } from '../models/user'
import userService from '../services/user.service'
import { GoogleIcon } from './LoginForm'

interface UserProfileProps {
  userProfile: User
  onUserUpdated?: (user: User) => void
  allowDelete: boolean
  allTags?: Tag[]
}

export default function UserProfile(props: UserProfileProps) {
  const { userProfile, onUserUpdated, allowDelete, allTags = [] } = props
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<User>({
    defaultValues: userProfile,
  })
  const navigate = useNavigate()
  const { user: currentUser, setUser, logout } = useAuth()
  const { showSnackBar } = useSnackBar()
  const [openDelete, setOpenDelete] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [addTagAnchorEl, setAddTagAnchorEl] = useState<HTMLButtonElement | null>(null)

  useEffect(() => {
    reset(userProfile)
  }, [userProfile, reset])

  const onSubmit: SubmitHandler<User> = async (data) => {
    let updatedUser: User
    setIsSubmitting(true)
    try {
      if (currentUser?.uuid === userProfile.uuid) {
        updatedUser = await userService.updateProfile(data)
        setUser(updatedUser)
        showSnackBar('User profile updated successfully.', 'success')
      } else {
        updatedUser = await userService.updateUser(userProfile.uuid, data)
        showSnackBar('User profile updated successfully.', 'success')
      }
      if (onUserUpdated) {
        onUserUpdated(updatedUser)
      }
    } catch (error) {
      if (
        error instanceof AxiosError &&
        error.response &&
        error.response.status === 409 &&
        typeof error.response.data.detail === 'string'
      ) {
        setError('email', {
          type: 'manual',
          message: '该邮箱已被使用',
        })
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

  const handleDeleteProfile = async () => {
    setOpenDelete(true)
  }

  const handleCancelDelete = () => setOpenDelete(false)

  const handleConfirmDelete = async () => {
    setOpenDelete(false)
    await userService.deleteSelf()
    showSnackBar('You account has been deleted.', 'success')
    logout()
    navigate('/')
  }

  const handleAddTagClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAddTagAnchorEl(event.currentTarget)
  }

  const handleCloseAddTag = () => {
    setAddTagAnchorEl(null)
  }

  const handleAddTag = async (tagUuid: string) => {
    setIsAddingTag(true)
    try {
      const updatedUser = await userService.addTagsToUser(userProfile.uuid, [tagUuid])
      showSnackBar('标签添加成功', 'success')
      if (onUserUpdated) {
        onUserUpdated(updatedUser)
      }
      handleCloseAddTag()
    } catch (error) {
      let msg
      if (error instanceof AxiosError && error.response && typeof error.response.data.detail === 'string')
        msg = error.response.data.detail
      else if (error instanceof Error) msg = error.message
      else msg = String(error)
      showSnackBar(msg, 'error')
    } finally {
      setIsAddingTag(false)
    }
  }

  const handleRemoveTag = async (tagUuid: string) => {
    setIsAddingTag(true)
    try {
      const updatedUser = await userService.removeTagFromUser(userProfile.uuid, tagUuid)
      showSnackBar('标签移除成功', 'success')
      if (onUserUpdated) {
        onUserUpdated(updatedUser)
      }
    } catch (error) {
      let msg
      if (error instanceof AxiosError && error.response && typeof error.response.data.detail === 'string')
        msg = error.response.data.detail
      else if (error instanceof Error) msg = error.message
      else msg = String(error)
      showSnackBar(msg, 'error')
    } finally {
      setIsAddingTag(false)
    }
  }

  const getUserTags = (): Tag[] => {
    if (!userProfile.tag_ids || userProfile.tag_ids.length === 0) return []
    return userProfile.tag_ids
      .map((tagId) => allTags.find((t) => t.uuid === tagId))
      .filter((t): t is Tag => t !== undefined)
  }

  const getAvailableTags = (): Tag[] => {
    const userTagIds = new Set(userProfile.tag_ids || [])
    return allTags.filter((t) => !userTagIds.has(t.uuid))
  }

  const userTags = getUserTags()
  const availableTags = getAvailableTags()
  const addTagOpen = Boolean(addTagAnchorEl)

  return (
    <div>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <IconButton aria-label='upload picture' component='label' sx={{ mt: 1 }}>
          <input hidden accept='image/*' type='file' />
          <Avatar
            sx={{ width: 56, height: 56 }}
            alt={userProfile.first_name + ' ' + userProfile.last_name}
            src={userProfile.picture && userProfile.picture}
          />
        </IconButton>

        <Box
          component='form'
          onSubmit={handleSubmit(onSubmit)}
          sx={{ mt: 3 }}
          key={userProfile.uuid}
          noValidate
          data-testid='user-profile-form'
        >
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                autoComplete='given-name'
                fullWidth
                id='firstName'
                label='First Name'
                {...register('first_name')}
                autoFocus
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                id='last_name'
                label='Last Name'
                autoComplete='family-name'
                {...register('last_name')}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                id='email'
                label='Email Address'
                autoComplete='email'
                required
                disabled={
                  userProfile.provider !== null &&
                  userProfile.provider !== undefined &&
                  userProfile.provider !== ''
                }
                error={!!errors.email}
                helperText={
                  errors.email?.message || (errors.email && 'Please provide an email address.')
                }
                {...register('email', { required: true })}
              />
            </Grid>

            {userProfile.provider && (
              <Grid size={12}>
                <TextField
                  fullWidth
                  label='Connected with'
                  id='provider'
                  disabled={true}
                  variant='standard'
                  InputProps={{
                    startAdornment: <GoogleIcon sx={{ mr: 1 }} />,
                  }}
                  {...register('provider')}
                />
              </Grid>
            )}

            {!userProfile.provider && (
              <Grid size={12}>
                <TextField
                  fullWidth
                  label='Password'
                  type='password'
                  id='password'
                  autoComplete='new-password'
                  {...register('password')}
                />
              </Grid>
            )}

            {currentUser?.is_superuser && (
              <>
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        defaultChecked={userProfile.is_active}
                        color='primary'
                        {...register('is_active')}
                      />
                    }
                    label='Is Active'
                    disabled={currentUser.uuid === userProfile.uuid}
                  />
                </Grid>
                <Grid size={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        defaultChecked={userProfile.is_superuser}
                        color='primary'
                        {...register('is_superuser')}
                      />
                    }
                    label='Is Super User'
                    disabled={currentUser.uuid === userProfile.uuid}
                  />
                </Grid>
              </>
            )}

            {currentUser?.is_superuser && (
              <Grid size={12}>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant='subtitle2' color='text.secondary'>
                    标签
                  </Typography>
                  <Button
                    size='small'
                    startIcon={<AddIcon />}
                    onClick={handleAddTagClick}
                    disabled={isAddingTag || availableTags.length === 0}
                  >
                    添加标签
                  </Button>
                </Box>
                {userTags.length === 0 ? (
                  <Typography variant='body2' color='text.secondary' sx={{ textAlign: 'center', py: 2 }}>
                    暂无标签
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {userTags.map((tag) => (
                      <Chip
                        key={tag.uuid}
                        label={tag.name}
                        sx={{
                          backgroundColor: tag.color,
                          color: '#fff',
                          fontWeight: 500,
                        }}
                        onDelete={() => handleRemoveTag(tag.uuid)}
                      />
                    ))}
                  </Box>
                )}
              </Grid>
            )}
          </Grid>
          <Button
            type='submit'
            fullWidth
            variant='contained'
            sx={{ mt: 3, mb: 2 }}
            disabled={isSubmitting}
          >
            {isSubmitting ? <CircularProgress size={20} /> : 'Update'}
          </Button>
          {allowDelete && (
            <Button
              fullWidth
              variant='outlined'
              sx={{ mb: 2 }}
              color='error'
              onClick={handleDeleteProfile}
            >
              Delete my account
            </Button>
          )}
        </Box>
      </Box>

      <Popover
        open={addTagOpen}
        anchorEl={addTagAnchorEl}
        onClose={handleCloseAddTag}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
      >
        <Box sx={{ p: 2, minWidth: 250 }}>
          <Typography variant='subtitle2' sx={{ mb: 1 }}>
            选择要添加的标签
          </Typography>
          {availableTags.length === 0 ? (
            <Typography variant='body2' color='text.secondary'>
              没有可用的标签
            </Typography>
          ) : (
            <List sx={{ maxHeight: 300, overflow: 'auto' }}>
              {availableTags.map((tag) => (
                <ListItem
                  key={tag.uuid}
                  onClick={() => handleAddTag(tag.uuid)}
                  sx={{ cursor: 'pointer' }}
                >
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
        </Box>
      </Popover>

      <Dialog
        open={openDelete}
        onClose={handleCancelDelete}
        aria-describedby='alert-profile-dialog-description'
      >
        <DialogContent>
          <DialogContentText id='alert-profile-dialog-description'>
            Are you sure you want to delete your account ?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} autoFocus>
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} variant='contained' color='primary'>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
