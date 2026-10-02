import { Link } from "@/components/link";
import { Separator, Typography } from "@/components/ui";
import { FaDiscord, FaGithub, FaLinkedin } from "react-icons/fa";

export default function Footer () {
  return (
    <footer>
      <Separator />

      <div className="flex flex-col md:flex-row p-4 gap-4 backdrop-blur-md bg-slate-200/20 dark:bg-black/20">
        <div className="flex flex-col gap-4 md:flex-1">
          <ul className="flex gap-4 flex-grow">
            {[
              { href: "https://discord.hexclave.com/", icon: FaDiscord },
              { href: "https://www.linkedin.com/company/stackframe-inc", icon: FaLinkedin },
              { href: "https://github.com/hexclave/hexclave", icon: FaGithub },
            ].map(({ href, icon: Icon }) => (
              <li key={href}>
                <Link href={href}>
                  <Icon size={20} className="text-gray-700 dark:text-gray-300" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-4 md:flex-1 md:justify-end flex-wrap">
          {[
            { href: "https://hexclave.com", label: "Home" },
            { href: "https://gplatform.org/datenschutz", label: "Privacy policy" },
            { href: "https://gplatform.org/terms", label: "Terms & conditions" },
            { href: "https://gplatform.org/impressum", label: "Imprint" },
          ].map(({ href, label }) => (
            <Link key={label} href={href}>
              <Typography variant="secondary" type='label'>{label}</Typography>
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
