export interface StaffInvitationEmail {
  email: string;
  name: string;
  role: string;
  token: string;
  expiresAt: Date;
}

export interface EmailSenderPort {
  sendStaffInvitation(invitation: StaffInvitationEmail): Promise<void>;
}
