using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Blazor.FileReader.ServerSide.Demo.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [EnableCors()]
    public class UploadController : ControllerBase
    {
        [HttpPost("files"), DisableRequestSizeLimit]
        public async Task<IActionResult> UploadFiles(List<IFormFile> files)
        {
            var result = files.Select(file => new { file.FileName, file.Length }).ToList();

            return Ok(result);
        }

    }
}