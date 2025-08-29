import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Upload, 
  Download, 
  Trash2, 
  FileText, 
  Image, 
  FileIcon,
  Plus
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Receipt {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
}

interface ReceiptManagerProps {
  clientId: string;
  onReceiptsChange?: () => void;
}

export function ReceiptManager({ clientId, onReceiptsChange }: ReceiptManagerProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<Receipt | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchReceipts();
  }, [clientId]);

  const fetchReceipts = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data, error } = await supabase
        .from('payment_receipts')
        .select('*')
        .eq('client_id', clientId)
        .eq('user_id', user.user.id)
        .order('uploaded_at', { ascending: false });

      if (error) {
        toast.error('Ошибка при загрузке чеков');
        return;
      }

      setReceipts(data || []);
    } catch (error) {
      toast.error('Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast.error('Необходимо войти в систему');
        return;
      }

      const uploadPromises = Array.from(files).map(async (file) => {
        // Проверяем размер файла (максимум 10 МБ)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`Файл "${file.name}" слишком большой. Максимальный размер: 10 МБ`);
          return null;
        }

        // Проверяем тип файла
        const allowedTypes = [
          'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        if (!allowedTypes.includes(file.type)) {
          toast.error(`Неподдерживаемый тип файла: ${file.name}`);
          return null;
        }

        // Создаем уникальное имя файла
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.user.id}/${clientId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

        // Загружаем файл в storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, file);

        if (uploadError) {
          toast.error(`Ошибка загрузки файла ${file.name}`);
          return null;
        }

        // Сохраняем информацию о файле в базу данных
        const { data: receiptData, error: dbError } = await supabase
          .from('payment_receipts')
          .insert({
            user_id: user.user.id,
            client_id: clientId,
            file_name: file.name,
            file_path: uploadData.path,
            file_size: file.size,
            mime_type: file.type,
          })
          .select()
          .single();

        if (dbError) {
          // Если не удалось сохранить в БД, удаляем файл из storage
          await supabase.storage.from('receipts').remove([uploadData.path]);
          toast.error(`Ошибка сохранения информации о файле ${file.name}`);
          return null;
        }

        return receiptData;
      });

      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter(result => result !== null);

      if (successfulUploads.length > 0) {
        toast.success(`Загружено файлов: ${successfulUploads.length}`);
        await fetchReceipts();
        onReceiptsChange?.();
      }
    } catch (error) {
      toast.error('Произошла ошибка при загрузке файлов');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = async (receipt: Receipt) => {
    try {
      const { data, error } = await supabase.storage
        .from('receipts')
        .download(receipt.file_path);

      if (error) {
        toast.error('Ошибка при скачивании файла');
        return;
      }

      // Создаем ссылку для скачивания
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = receipt.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Файл скачан');
    } catch (error) {
      toast.error('Произошла ошибка при скачивании');
    }
  };

  const handleDeleteClick = (receipt: Receipt) => {
    setReceiptToDelete(receipt);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!receiptToDelete) return;

    try {
      // Удаляем файл из storage
      const { error: storageError } = await supabase.storage
        .from('receipts')
        .remove([receiptToDelete.file_path]);

      if (storageError) {
        toast.error('Ошибка при удалении файла');
        return;
      }

      // Удаляем запись из базы данных
      const { error: dbError } = await supabase
        .from('payment_receipts')
        .delete()
        .eq('id', receiptToDelete.id);

      if (dbError) {
        toast.error('Ошибка при удалении записи');
        return;
      }

      toast.success('Чек удален');
      await fetchReceipts();
      onReceiptsChange?.();
    } catch (error) {
      toast.error('Произошла ошибка при удалении');
    } finally {
      setDeleteDialogOpen(false);
      setReceiptToDelete(null);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    } else if (mimeType === 'application/pdf') {
      return <FileText className="h-4 w-4" />;
    } else {
      return <FileIcon className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    const units = ['Б', 'КБ', 'МБ'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Чеки об оплате</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Чеки об оплате</CardTitle>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              {uploading ? 'Загрузка...' : 'Добавить чек'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleFileUpload}
            className="hidden"
          />

          {receipts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Чеки не загружены</p>
              <p className="text-sm">Нажмите "Добавить чек" для загрузки файлов</p>
            </div>
          ) : (
            <div className="space-y-3">
              {receipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getFileIcon(receipt.mime_type)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {receipt.file_name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatFileSize(receipt.file_size)}</span>
                        <span>•</span>
                        <span>{formatDate(receipt.uploaded_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {receipt.mime_type.startsWith('image/') ? 'Изображение' : 
                       receipt.mime_type === 'application/pdf' ? 'PDF' : 'Документ'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(receipt)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(receipt)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить чек?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить чек "{receiptToDelete?.file_name}"? 
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}