# Beta Test Notes - Version 1.0.5

## What's New

### Authentication & Session Management
- **Remember Me**: Improved session persistence. When "Remember Me" is enabled, your login session will be maintained even after app restarts. No more frequent logouts!
- **Resend Verification Code**: Added a "Resend" button on the verification code screen. If you don't receive the code, you can easily request a new one.

### User Experience Improvements
- **Auto Refresh**: 
  - Home feed now automatically refreshes when you navigate to it
  - Product detail pages support pull-to-refresh to get the latest information
- **Loading States**: 
  - Save product button now shows loading state and prevents multiple submissions
  - Login screen buttons are disabled during processing to prevent duplicate requests
- **Auto Focus**: Verification code input field automatically receives focus when the verification screen appears

### Photo Management
- **Fixed Photo Duplication**: Fixed an issue where editing a product would duplicate existing photos. Now only newly added photos are uploaded.
- **Photo Display**: Improved photo loading and display reliability

### User Display Names
- **Smart Username Display**: Users without a custom display name will now show their email username (e.g., "user" from "user@example.com") instead of GUIDs, making the feed more readable.

## What to Test

1. **Login Flow**:
   - Login with "Remember Me" enabled and restart the app - you should stay logged in
   - Use the "Resend" button if verification code doesn't arrive
   - Verify that buttons are disabled during login process

2. **Feed & Navigation**:
   - Navigate away from home feed and come back - it should auto-refresh
   - Pull down on product detail pages to refresh
   - Check that photos load correctly

3. **Product Management**:
   - Edit an existing product and save without adding new photos - verify no duplicates
   - Add new photos to an existing product - verify only new photos are uploaded
   - Create a new product and verify save button shows loading state

4. **User Display**:
   - Check that user names in feed show readable names instead of GUIDs
   - Verify users without display names show email usernames

## Known Issues
- None at this time

## Feedback
Please report any issues or suggestions through TestFlight feedback or contact the development team.

Thank you for testing!

