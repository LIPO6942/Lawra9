import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// Vercel Cron Secret for Authorization
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  // 1. Verify Authorization Header
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    console.error('Unauthorized cron access attempt.');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate3Days = new Date(today);
    targetDate3Days.setDate(today.getDate() + 3);

    const targetDate7DaysAgo = new Date(today);
    targetDate7DaysAgo.setDate(today.getDate() - 7);

    // Format dates for Firestore query (assuming YYYY-MM-DD format based on typical input)
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const date3DaysStr = formatDate(targetDate3Days);
    const todayStr = formatDate(today);
    const date7DaysAgoStr = formatDate(targetDate7DaysAgo);

    console.log(`Checking invoices for: Due in 3 days (${date3DaysStr}), Due today (${todayStr}), Overdue by 7 days (${date7DaysAgoStr})`);

    // Fetch *all* pending documents from all users (requires Firebase Admin)
    // Assuming your documents are stored in a top-level 'documents' collection, or nested under users.
    // If nested under users, you'll need a collectionGroup query or to iterate users.
    // Here we'll assume a collectionGroup query for 'documents' if they are subcollections.

    const documentsRef = adminDb.collectionGroup('documents');
    
    // We only want pending documents
    const pendingDocsSnapshot = await documentsRef.where('status', '==', 'pending').get();

    let emailsSent = 0;
    const notificationsToSend: { userEmail: string, docName: string, dueDate: string, type: string }[] = [];

    // Process each pending document
    for (const doc of pendingDocsSnapshot.docs) {
      const data = doc.data();
      const dueDateStr = data.dueDate;

      if (!dueDateStr) continue;

      let notificationType = null;

      if (dueDateStr === date3DaysStr) {
        notificationType = 'J-3';
      } else if (dueDateStr === todayStr) {
        notificationType = 'Jour-J';
      } else if (dueDateStr === date7DaysAgoStr) {
        notificationType = 'J+7 (En retard)';
      }

      if (notificationType) {
        // Find the user email associated with this document.
        // If the document is in users/{userId}/documents, we can get userId from the path.
        const userId = doc.ref.parent.parent?.id;
        
        if (userId) {
            try {
                // Fetch user email using Firebase Admin Auth
                const userRecord = await admin.auth().getUser(userId);
                const userEmail = userRecord.email;

                if (userEmail) {
                    notificationsToSend.push({
                        userEmail,
                        docName: data.name || 'Document sans nom',
                        dueDate: dueDateStr,
                        type: notificationType
                    });
                }
            } catch (authError) {
                console.error(`Could not fetch user ${userId} for document ${doc.id}:`, authError);
            }
        }
      }
    }

    // Now, send the emails (using Resend, Sendgrid, NodeMailer, etc.)
    // For this example, we'll just log them. You need to integrate your preferred email provider here.
    for (const notification of notificationsToSend) {
        console.log(`[EMAIL SIMULATION] Sending ${notification.type} reminder to ${notification.userEmail} for document ${notification.docName} due on ${notification.dueDate}`);
        // await sendEmail(notification.userEmail, 'Rappel de facture', `Votre facture ${notification.docName} arrive à échéance le ${notification.dueDate}.`);
        emailsSent++;
    }

    return NextResponse.json({ 
        success: true, 
        message: `Cron job executed successfully. Simulated sending ${emailsSent} emails.`,
        details: notificationsToSend
    });

  } catch (error: any) {
    console.error('Error executing cron job:', error);
    return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}
