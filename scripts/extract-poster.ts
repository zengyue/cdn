import path from 'node:path';
import fs from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// 支持的视频格式
const SUPPORTED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];

// 检查是否为支持的视频文件
function isSupportedVideoFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_VIDEO_EXTENSIONS.includes(ext);
}

// 获取目录下所有视频文件（支持递归子目录）
async function getVideoFilesFromDirectory(
  dirPath: string,
  recursive: boolean = false
): Promise<string[]> {
  const videoFiles: string[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isFile() && isSupportedVideoFile(entry.name)) {
        videoFiles.push(fullPath);
      } else if (entry.isDirectory() && recursive) {
        // 递归处理子目录
        const subDirFiles = await getVideoFilesFromDirectory(
          fullPath,
          recursive
        );
        videoFiles.push(...subDirFiles);
      }
    }
  } catch (error) {
    console.error(`❌ 无法读取目录: ${dirPath}`, error);
  }

  return videoFiles;
}

// 检查 FFmpeg 是否可用
async function checkFFmpeg(): Promise<boolean> {
  try {
    await execAsync('ffmpeg -version');
    return true;
  } catch (error) {
    console.error('❌ FFmpeg 未安装或不在 PATH 中');
    console.error('请安装 FFmpeg: brew install ffmpeg');
    return false;
  }
}

// 提取视频首帧为 WebP 格式
async function extractPoster(
  videoPath: string,
  outputPath: string,
  quality: number = 75
): Promise<void> {
  try {
    // 使用 FFmpeg 提取第一帧为 WebP 格式
    // -i: 输入文件
    // -vframes 1: 只提取一帧
    // -c:v libwebp: 使用 WebP 编码器
    // -quality: WebP 质量 (0-100, 数字越大质量越高)
    // -y: 覆盖输出文件
    const command = `ffmpeg -i "${videoPath}" -vframes 1 -c:v libwebp -quality ${quality} -y "${outputPath}"`;

    await execAsync(command);
    console.log(`✅ 成功提取首帧: ${videoPath} -> ${outputPath}`);
  } catch (error) {
    console.error(`❌ 提取首帧失败: ${videoPath}`, error);
    throw error;
  }
}

// 自动扫描 monet 目录下的所有视频文件
async function main() {
  // 检查 FFmpeg 是否可用
  if (!(await checkFFmpeg())) {
    process.exit(1);
  }

  console.log('🔍 正在扫描 monet 目录下的所有视频文件...');

  // 递归扫描 monet 目录下的所有视频文件
  const allVideoFiles = await getVideoFilesFromDirectory('monet', true);

  if (allVideoFiles.length === 0) {
    console.log('📹 未找到任何视频文件');
    return;
  }

  console.log(`📹 找到 ${allVideoFiles.length} 个视频文件需要处理`);

  const defaultQuality = 75; // 统一使用 75 质量

  for (const videoFile of allVideoFiles) {
    try {
      const inputPath = path.resolve(videoFile);

      // 生成输出路径 (同名但扩展名改为 _poster.webp)
      const ext = path.extname(inputPath);
      const outputPath = inputPath.replace(ext, '_poster.webp');

      // 检查输出文件是否已存在
      try {
        await fs.access(outputPath);
        console.log(`⏭️  跳过已存在的文件: ${outputPath}`);
        continue;
      } catch (error) {
        // 文件不存在，继续处理
      }

      // 检查输入文件是否存在
      try {
        await fs.access(inputPath);
      } catch (error) {
        console.error(`❌ 文件不存在: ${inputPath}`);
        continue;
      }

      // 提取首帧
      await extractPoster(inputPath, outputPath, defaultQuality);

      // 获取文件大小信息
      const outputStats = await fs.stat(outputPath);
      console.log(`   首帧大小: ${(outputStats.size / 1024).toFixed(1)}KB`);
    } catch (error) {
      console.error(`❌ 处理失败: ${videoFile}`, error);
    }
  }

  console.log('🎉 视频首帧提取完成！');
}

// 如果直接运行此脚本
const isMainModule =
  process.argv[1] === import.meta.url ||
  process.argv[1]?.endsWith('extract-poster.ts');
if (isMainModule) {
  main().catch(console.error);
}

export { extractPoster, getVideoFilesFromDirectory, isSupportedVideoFile };
